# Le pont JavaScript est appelé par réflexion depuis la WebView.
-keepclassmembers class africa.tano.sdk.TanoVerificationActivity$Bridge {
    @android.webkit.JavascriptInterface <methods>;
}
