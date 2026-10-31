package io.github.cnosmn.derslik.bbbnative

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.media.projection.MediaProjection
import android.os.Build
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import org.webrtc.AddIceObserver
import org.webrtc.DataChannel
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.Logging
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpParameters
import org.webrtc.RtpTransceiver
import org.webrtc.ScreenCapturerAndroid
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoSource
import org.webrtc.VideoTrack
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * One screen sharing publication: captures the screen through MediaProjection
 * and sends it as a send-only VP8 track to BigBlueButton's bbb-webrtc-sfu.
 * Signaling (offer/answer/candidates) is relayed by the web client.
 */
class ScreenShareSession(
  private val context: Context,
  consent: Intent,
  iceServers: List<PeerConnection.IceServer>,
  private val listener: Listener,
) {
  interface Listener {
    fun onLocalIceCandidate(candidate: IceCandidate)
    fun onSignalingStateChange(state: String)
    fun onConnectionStateChange(state: String)
    /** The capture ended without being asked to (system stop, lock, revoked consent). */
    fun onCaptureStopped()
  }

  companion object {
    private const val TAG = "BbbScreenShare"
    private const val MAX_LONG_SIDE = 1920
    private const val FPS = 15

    private val eglBase: EglBase by lazy { EglBase.create() }
    private var factoryInstance: PeerConnectionFactory? = null

    @Synchronized
    private fun sharedFactory(context: Context): PeerConnectionFactory =
      factoryInstance ?: run {
        PeerConnectionFactory.initialize(
          PeerConnectionFactory.InitializationOptions.builder(context).createInitializationOptions(),
        )
        if ((context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
          Logging.enableLogToDebugOutput(Logging.Severity.LS_WARNING)
        }
        PeerConnectionFactory.builder()
          .setVideoEncoderFactory(DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, false))
          .setVideoDecoderFactory(DefaultVideoDecoderFactory(eglBase.eglBaseContext))
          .createPeerConnectionFactory()
          .also { factoryInstance = it }
      }
  }

  private val appContext = context.applicationContext
  private val factory = sharedFactory(appContext)
  private val capturer: ScreenCapturerAndroid
  private val textureHelper: SurfaceTextureHelper
  private val videoSource: VideoSource
  private val videoTrack: VideoTrack
  private val peerConnection: PeerConnection
  private val transceiver: RtpTransceiver

  @Volatile private var disposed = false

  init {
    capturer = ScreenCapturerAndroid(
      consent,
      object : MediaProjection.Callback() {
        override fun onStop() {
          Log.i(TAG, "MediaProjection stopped by the system")
          if (!disposed) listener.onCaptureStopped()
        }
      },
    )
    textureHelper = SurfaceTextureHelper.create("BbbScreenCapture", eglBase.eglBaseContext)
    videoSource = factory.createVideoSource(true)
    capturer.initialize(textureHelper, appContext, videoSource.capturerObserver)
    val (width, height) = captureSize()
    capturer.startCapture(width, height, FPS)
    videoTrack = factory.createVideoTrack("screen0", videoSource)

    val config = PeerConnection.RTCConfiguration(iceServers).apply {
      sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
      bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE
      rtcpMuxPolicy = PeerConnection.RtcpMuxPolicy.REQUIRE
      continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_ONCE
    }
    peerConnection = factory.createPeerConnection(config, PeerObserver())
      ?: throw IllegalStateException("Could not create PeerConnection")

    transceiver = peerConnection.addTransceiver(
      videoTrack,
      RtpTransceiver.RtpTransceiverInit(RtpTransceiver.RtpTransceiverDirection.SEND_ONLY, listOf("stream")),
    )
    preferVp8()
    Log.i(TAG, "Capturing ${width}x$height@$FPS")
  }

  fun createOffer(onResult: (Result<String>) -> Unit) {
    peerConnection.createOffer(object : SdpObserverAdapter() {
      override fun onCreateSuccess(description: SessionDescription) {
        peerConnection.setLocalDescription(object : SdpObserverAdapter() {
          override fun onSetSuccess() {
            keepResolutionUnderLoad()
            onResult(Result.success(description.description))
          }

          override fun onSetFailure(error: String) = onResult(Result.failure(Exception(error)))
        }, description)
      }

      override fun onCreateFailure(error: String) = onResult(Result.failure(Exception(error)))
    }, MediaConstraints())
  }

  fun setRemoteAnswer(sdp: String, onResult: (Result<Unit>) -> Unit) {
    peerConnection.setRemoteDescription(object : SdpObserverAdapter() {
      override fun onSetSuccess() = onResult(Result.success(Unit))
      override fun onSetFailure(error: String) = onResult(Result.failure(Exception(error)))
    }, SessionDescription(SessionDescription.Type.ANSWER, sdp))
  }

  fun addRemoteCandidate(candidate: IceCandidate, onResult: (Result<Unit>) -> Unit) {
    peerConnection.addIceCandidate(candidate, object : AddIceObserver {
      override fun onAddSuccess() = onResult(Result.success(Unit))
      override fun onAddFailure(error: String) = onResult(Result.failure(Exception(error)))
    })
  }

  fun dispose() {
    if (disposed) return
    disposed = true
    try {
      capturer.stopCapture()
    } catch (e: Exception) {
      Log.w(TAG, "stopCapture failed", e)
    }
    peerConnection.dispose()
    videoTrack.dispose()
    videoSource.dispose()
    capturer.dispose()
    textureHelper.dispose()
    Log.i(TAG, "Screen share disposed")
  }

  // bbb-webrtc-sfu is configured for VP8 content (codec_video_content: VP8).
  private fun preferVp8() {
    val codecs = factory.getRtpSenderCapabilities(org.webrtc.MediaStreamTrack.MediaType.MEDIA_TYPE_VIDEO).codecs
    val (vp8, others) = codecs.partition { it.name.equals("VP8", ignoreCase = true) }
    if (vp8.isNotEmpty()) transceiver.setCodecPreferences(vp8 + others)
  }

  // Text and slides are useless when blurry; drop frames rather than resolution.
  private fun keepResolutionUnderLoad() {
    val sender = transceiver.sender
    val parameters = sender.parameters
    parameters.degradationPreference = RtpParameters.DegradationPreference.MAINTAIN_RESOLUTION
    sender.setParameters(parameters)
  }

  private fun captureSize(): Pair<Int, Int> {
    val (width, height) = screenSize()
    val scale = MAX_LONG_SIDE.toDouble() / max(width, height)
    if (scale >= 1.0) return even(width) to even(height)
    return even((width * scale).roundToInt()) to even((height * scale).roundToInt())
  }

  private fun screenSize(): Pair<Int, Int> {
    val windowManager = context.getSystemService(WindowManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val bounds = windowManager.maximumWindowMetrics.bounds
      return bounds.width() to bounds.height()
    }
    val metrics = DisplayMetrics()
    @Suppress("DEPRECATION")
    windowManager.defaultDisplay.getRealMetrics(metrics)
    return metrics.widthPixels to metrics.heightPixels
  }

  private fun even(value: Int) = value and 1.inv()

  private inner class PeerObserver : PeerConnection.Observer {
    override fun onSignalingChange(state: PeerConnection.SignalingState) =
      listener.onSignalingStateChange(state.name.lowercase().replace('_', '-'))

    override fun onConnectionChange(state: PeerConnection.PeerConnectionState) {
      Log.i(TAG, "Connection state: $state")
      listener.onConnectionStateChange(state.name.lowercase())
    }

    override fun onIceCandidate(candidate: IceCandidate) = listener.onLocalIceCandidate(candidate)

    override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {}
    override fun onIceConnectionReceivingChange(receiving: Boolean) {}
    override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) {}
    override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>) {}
    override fun onAddStream(stream: MediaStream) {}
    override fun onRemoveStream(stream: MediaStream) {}
    override fun onDataChannel(channel: DataChannel) {}
    override fun onRenegotiationNeeded() {}
  }

  private open class SdpObserverAdapter : SdpObserver {
    override fun onCreateSuccess(description: SessionDescription) {}
    override fun onSetSuccess() {}
    override fun onCreateFailure(error: String) {}
    override fun onSetFailure(error: String) {}
  }
}
