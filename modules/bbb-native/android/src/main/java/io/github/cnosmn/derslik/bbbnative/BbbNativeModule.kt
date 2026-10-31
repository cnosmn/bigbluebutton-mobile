package io.github.cnosmn.derslik.bbbnative

import android.webkit.WebSettings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BbbNativeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BbbNative")

    Function("getDefaultUserAgent") {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      WebSettings.getDefaultUserAgent(context)
    }
  }
}
