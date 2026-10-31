import ExpoModulesCore

public class BbbNativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BbbNative")

    // WKWebView's default user agent passes BigBlueButton's browser check as is.
    Function("getDefaultUserAgent") { () -> String? in
      return nil
    }

    // Android-only workaround; nothing to do on iOS.
    AsyncFunction("disableAutofill") {}
  }
}
