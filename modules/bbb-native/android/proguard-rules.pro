# libjingle_peerconnection_so looks up these classes by name over JNI
# (JNI_OnLoad, callbacks), which R8 cannot see. Without this, release builds
# abort with "JNI DETECTED ERROR ... java_class == null" when sharing starts.
# org.jni_zero is the JNI glue WebRTC registers its natives through.
-keep class org.webrtc.** { *; }
-keep class org.jni_zero.** { *; }
-dontwarn org.webrtc.**
-dontwarn org.jni_zero.**
