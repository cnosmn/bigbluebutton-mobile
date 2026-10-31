# libjingle_peerconnection_so looks up these classes by name over JNI
# (JNI_OnLoad, callbacks), which R8 cannot see. Without this, release builds
# abort with "JNI DETECTED ERROR ... java_class == null" when sharing starts.
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**
