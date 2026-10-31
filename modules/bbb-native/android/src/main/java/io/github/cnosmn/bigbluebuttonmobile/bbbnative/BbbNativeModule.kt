package io.github.cnosmn.bigbluebuttonmobile.bbbnative

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.webkit.WebSettings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import org.webrtc.IceCandidate
import org.webrtc.PeerConnection

/**
 * Native side of BigBlueButton's mobile app bridge. The JS layer maps the web
 * client's calls (initializeScreenShare, createScreenShareOffer, ...) onto
 * these functions and forwards the events back into the page.
 *
 * All session state is touched on the main thread only.
 */
class BbbNativeModule : Module() {
  companion object {
    private const val TAG = "BbbScreenShare"
    private const val REQUEST_CONSENT = 4202

    const val EVENT_LOCAL_ICE_CANDIDATE = "onScreenShareLocalIceCandidate"
    const val EVENT_SIGNALING_STATE = "onScreenShareSignalingStateChange"
    const val EVENT_CONNECTION_STATE = "onScreenShareConnectionStateChange"
    const val EVENT_STOPPED = "onScreenShareStopped"
  }

  private val mainHandler = Handler(Looper.getMainLooper())
  private var pendingConsent: Promise? = null
  private var consent: Intent? = null
  private var session: ScreenShareSession? = null

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("BbbNative")

    Events(EVENT_LOCAL_ICE_CANDIDATE, EVENT_SIGNALING_STATE, EVENT_CONNECTION_STATE, EVENT_STOPPED)

    Function("getDefaultUserAgent") {
      WebSettings.getDefaultUserAgent(context)
    }

    // Android's autofill popup (saved e-mails/passwords) takes focus from the
    // WebView and closes the keyboard on every keystroke in login forms.
    // Excluding the window from autofill keeps the keyboard and its own
    // suggestions working.
    AsyncFunction("disableAutofill") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        appContext.currentActivity?.window?.decorView?.importantForAutofill =
          View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
      }
    }.runOnQueue(Queues.MAIN)

    // Shows the system "start recording or casting?" dialog and starts the
    // foreground service. Resolves once capturing is allowed.
    AsyncFunction("initializeScreenShare") { promise: Promise ->
      stopSession(notifyWeb = false)
      pendingConsent?.reject("E_SUPERSEDED", "A newer screen share request was made", null)
      pendingConsent = promise
      withNotificationPermission { requestCaptureConsent() }
    }.runOnQueue(Queues.MAIN)

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_CONSENT) return@OnActivityResult
      val promise = pendingConsent ?: return@OnActivityResult
      pendingConsent = null

      val data = payload.data
      if (payload.resultCode != Activity.RESULT_OK || data == null) {
        promise.reject("E_CONSENT_DENIED", "Screen capture was not allowed", null)
        return@OnActivityResult
      }

      consent = data
      ScreenShareService.onStopRequested = { reason ->
        mainHandler.post { stopSession(notifyWeb = true, reason = reason) }
      }
      ScreenShareService.onStarted = { error ->
        if (error == null) {
          promise.resolve(null)
        } else {
          Log.e(TAG, "Foreground service failed to start", error)
          stopSession(notifyWeb = false)
          promise.reject("E_SERVICE", error.message, error)
        }
      }
      ScreenShareService.start(context)
    }

    // Argument: BBB's STUN/TURN dictionary as JSON, { stun: [url], turn: [{ urls, username, password }] }.
    // Resolves with the local SDP offer.
    AsyncFunction("createScreenShareOffer") { stunTurnJson: String, promise: Promise ->
      val data = consent
      if (data == null) {
        promise.reject("E_NOT_INITIALIZED", "initializeScreenShare must succeed first", null)
        return@AsyncFunction
      }
      // A consent result can only be used for a single MediaProjection.
      consent = null

      val newSession = try {
        ScreenShareSession(context, data, parseIceServers(stunTurnJson), SessionListener())
      } catch (e: Exception) {
        Log.e(TAG, "Could not start screen capture", e)
        stopSession(notifyWeb = false)
        promise.reject("E_CAPTURE", e.message, e)
        return@AsyncFunction
      }
      session = newSession
      newSession.createOffer { result ->
        result.fold(
          onSuccess = { sdp -> promise.resolve(sdp) },
          onFailure = { error -> promise.reject("E_OFFER", error.message, error) },
        )
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setScreenShareRemoteSdp") { sdp: String, promise: Promise ->
      val current = session
      if (current == null) {
        promise.reject("E_NO_SESSION", "No screen share in progress", null)
        return@AsyncFunction
      }
      current.setRemoteAnswer(sdp) { result ->
        result.fold(
          onSuccess = { promise.resolve(null) },
          onFailure = { error -> promise.reject("E_REMOTE_SDP", error.message, error) },
        )
      }
    }.runOnQueue(Queues.MAIN)

    // Argument: an RTCIceCandidateInit as JSON.
    AsyncFunction("addScreenShareRemoteIceCandidate") { candidateJson: String, promise: Promise ->
      val current = session
      if (current == null) {
        promise.reject("E_NO_SESSION", "No screen share in progress", null)
        return@AsyncFunction
      }
      val json = JSONObject(candidateJson)
      val candidate = IceCandidate(
        json.optString("sdpMid"),
        json.optInt("sdpMLineIndex", 0),
        json.getString("candidate"),
      )
      current.addRemoteCandidate(candidate) { result ->
        result.fold(
          onSuccess = { promise.resolve(null) },
          onFailure = { error -> promise.reject("E_REMOTE_CANDIDATE", error.message, error) },
        )
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("stopScreenShare") { promise: Promise ->
      stopSession(notifyWeb = false)
      promise.resolve(null)
    }.runOnQueue(Queues.MAIN)

    OnDestroy {
      mainHandler.post { stopSession(notifyWeb = false) }
    }
  }

  // Android 13+ hides notifications until the user allows them, which would
  // hide the "your screen is being shared" notification and its stop action.
  // Ask right before the first share, when the reason is obvious; sharing
  // goes ahead whatever the answer.
  private fun withNotificationPermission(then: () -> Unit) {
    val permissions = appContext.permissions
    if (
      Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
      permissions == null ||
      permissions.hasGrantedPermissions(Manifest.permission.POST_NOTIFICATIONS)
    ) {
      then()
      return
    }
    permissions.askForPermissions({ _ -> mainHandler.post { then() } }, Manifest.permission.POST_NOTIFICATIONS)
  }

  private fun requestCaptureConsent() {
    val promise = pendingConsent ?: return
    val activity = appContext.currentActivity
    if (activity == null) {
      pendingConsent = null
      promise.reject("E_NO_ACTIVITY", "No activity to show the screen capture dialog", null)
      return
    }
    val manager = activity.getSystemService(MediaProjectionManager::class.java)
    activity.startActivityForResult(manager.createScreenCaptureIntent(), REQUEST_CONSENT)
  }

  /**
   * Tears down capture, peer connection and the foreground service. With
   * [notifyWeb], the page is told so that BigBlueButton updates its UI; it is
   * false when the page itself asked to stop.
   */
  private fun stopSession(notifyWeb: Boolean, reason: String = "") {
    val wasActive = session != null || consent != null
    session?.dispose()
    session = null
    consent = null
    ScreenShareService.onStopRequested = null
    ScreenShareService.onStarted = null
    appContext.reactContext?.let { ScreenShareService.stop(it) }
    if (notifyWeb && wasActive) {
      Log.i(TAG, "Screen share stopped: $reason")
      sendEvent(EVENT_STOPPED, mapOf("reason" to reason))
    }
  }

  private fun parseIceServers(stunTurnJson: String): List<PeerConnection.IceServer> {
    val json = JSONObject(stunTurnJson)
    val servers = mutableListOf<PeerConnection.IceServer>()

    json.optJSONArray("stun")?.let { stun ->
      for (i in 0 until stun.length()) {
        servers += PeerConnection.IceServer.builder(stun.getString(i)).createIceServer()
      }
    }
    json.optJSONArray("turn")?.let { turn ->
      for (i in 0 until turn.length()) {
        val entry = turn.getJSONObject(i)
        val urls = when (val value = entry.get("urls")) {
          is JSONArray -> List(value.length()) { value.getString(it) }
          else -> listOf(value.toString())
        }
        servers += PeerConnection.IceServer.builder(urls)
          .setUsername(entry.optString("username"))
          .setPassword(entry.optString("password"))
          .createIceServer()
      }
    }
    return servers
  }

  // Called on WebRTC's threads; events can be sent from any thread.
  private inner class SessionListener : ScreenShareSession.Listener {
    override fun onLocalIceCandidate(candidate: IceCandidate) {
      sendEvent(
        EVENT_LOCAL_ICE_CANDIDATE,
        mapOf(
          "candidate" to candidate.sdp,
          "sdpMid" to candidate.sdpMid,
          "sdpMLineIndex" to candidate.sdpMLineIndex,
        ),
      )
    }

    override fun onSignalingStateChange(state: String) {
      sendEvent(EVENT_SIGNALING_STATE, mapOf("state" to state))
    }

    override fun onConnectionStateChange(state: String) {
      sendEvent(EVENT_CONNECTION_STATE, mapOf("state" to state))
      if (state == "failed") {
        mainHandler.post { stopSession(notifyWeb = true, reason = "connection-failed") }
      }
    }

    override fun onCaptureStopped() {
      mainHandler.post { stopSession(notifyWeb = true, reason = "capture-stopped") }
    }
  }
}
