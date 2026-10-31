package io.github.cnosmn.derslik.bbbnative

import android.os.Handler
import android.os.SystemClock
import org.webrtc.CapturerObserver
import org.webrtc.VideoFrame

/**
 * Shapes the frame stream coming from MediaProjection before it reaches the
 * encoder:
 *
 * - Caps the frame rate. The virtual display ignores the requested rate and
 *   delivers up to 60 fps while content moves, which overwhelms software VP8.
 *   A frame that arrives too early is held until its slot; while it is held
 *   the capturer cannot deliver another one, and the SurfaceTexture keeps only
 *   the newest image, so the most recent screen state is never lost.
 * - Repeats the last frame while the screen is static. MediaProjection only
 *   produces frames on changes, so without this the encoder would stop after
 *   one (possibly blurry) frame; repeats let it refine the image until text is
 *   sharp. The repeat source is a CPU copy because holding the capturer's
 *   texture would block new frames.
 *
 * All calls run on [handler], the capture thread.
 */
class FrameRepeater(
  private val target: CapturerObserver,
  private val handler: Handler,
  maxFps: Int,
) : CapturerObserver {
  companion object {
    private const val IDLE_MS = 500L
    private const val REPEAT_MS = 250L
  }

  private val minIntervalMs = 1000L / maxFps
  private var lastBuffer: VideoFrame.I420Buffer? = null
  private var lastRotation = 0
  private var lastForwardAtMs = 0L
  private var lastCapturedAtMs = 0L
  private var pending: VideoFrame? = null
  private var running = false

  private val forwardPending = Runnable {
    pending?.let {
      forward(it)
      it.release()
    }
    pending = null
  }

  private val repeat = object : Runnable {
    override fun run() {
      if (!running) return
      val buffer = lastBuffer
      val now = SystemClock.uptimeMillis()
      if (buffer != null && pending == null && now - lastCapturedAtMs >= IDLE_MS) {
        buffer.retain()
        // Same clock (CLOCK_MONOTONIC) as the SurfaceTexture timestamps.
        val frame = VideoFrame(buffer, lastRotation, System.nanoTime())
        target.onFrameCaptured(frame)
        frame.release()
        lastForwardAtMs = now
      }
      handler.postDelayed(this, REPEAT_MS)
    }
  }

  override fun onCapturerStarted(success: Boolean) {
    target.onCapturerStarted(success)
    running = success
    if (success) handler.postDelayed(repeat, REPEAT_MS)
  }

  override fun onCapturerStopped() {
    stop()
    target.onCapturerStopped()
  }

  override fun onFrameCaptured(frame: VideoFrame) {
    if (!running) return
    val now = SystemClock.uptimeMillis()
    lastCapturedAtMs = now
    val wait = lastForwardAtMs + minIntervalMs - now
    if (wait <= 0) {
      forward(frame)
      return
    }
    // Only one frame can be outstanding: the capturer waits for its release.
    frame.retain()
    pending = frame
    handler.postDelayed(forwardPending, wait)
  }

  private fun forward(frame: VideoFrame) {
    target.onFrameCaptured(frame)
    lastForwardAtMs = SystemClock.uptimeMillis()
    lastBuffer?.release()
    lastBuffer = frame.buffer.toI420()
    lastRotation = frame.rotation
  }

  fun stop() {
    running = false
    handler.removeCallbacks(repeat)
    handler.removeCallbacks(forwardPending)
    pending?.release()
    pending = null
    lastBuffer?.release()
    lastBuffer = null
  }
}
