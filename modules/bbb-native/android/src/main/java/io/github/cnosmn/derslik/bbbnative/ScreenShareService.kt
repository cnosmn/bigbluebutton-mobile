package io.github.cnosmn.derslik.bbbnative

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

/**
 * Foreground service that must be running while the screen is captured
 * (foregroundServiceType="mediaProjection"; mandatory since Android 10 and
 * enforced before getMediaProjection() since Android 14). It holds no media
 * state itself: it shows the ongoing notification and reports stop requests.
 */
class ScreenShareService : Service() {
  companion object {
    private const val CHANNEL_ID = "bbb_screen_share"
    private const val NOTIFICATION_ID = 4201
    private const val ACTION_STOP = "io.github.cnosmn.derslik.bbbnative.STOP_SCREEN_SHARE"

    /** Called on the main thread once startForeground() ran; the error is null on success. */
    @Volatile var onStarted: ((error: Exception?) -> Unit)? = null

    /** Called when the user stops sharing from the notification or removes the task. */
    @Volatile var onStopRequested: ((reason: String) -> Unit)? = null

    fun start(context: Context) {
      ContextCompat.startForegroundService(context, Intent(context, ScreenShareService::class.java))
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, ScreenShareService::class.java))
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      onStopRequested?.invoke("notification")
      return START_NOT_STICKY
    }

    val started = onStarted
    onStarted = null
    try {
      val notification = buildNotification()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (e: Exception) {
      started?.invoke(e)
      stopSelf()
      return START_NOT_STICKY
    }
    started?.invoke(null)
    // Media projection consent cannot be restored after the process dies.
    return START_NOT_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    onStopRequested?.invoke("task-removed")
    stopSelf()
  }

  private fun buildNotification(): Notification {
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(
          CHANNEL_ID,
          getString(R.string.bbb_screen_share_channel),
          NotificationManager.IMPORTANCE_LOW,
        ),
      )
    }

    val immutable = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    val openApp = packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(this, 0, it, immutable)
    }
    val stop = PendingIntent.getService(
      this,
      1,
      Intent(this, ScreenShareService::class.java).setAction(ACTION_STOP),
      immutable,
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.bbb_ic_screen_share)
      .setContentTitle(getString(R.string.bbb_screen_share_title))
      .setContentText(getString(R.string.bbb_screen_share_text))
      .setContentIntent(openApp)
      .addAction(0, getString(R.string.bbb_screen_share_stop), stop)
      .setOngoing(true)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .build()
  }
}
