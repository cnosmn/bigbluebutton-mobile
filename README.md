# Derslik

BigBlueButton 3.0 derslerine tabletten katılmak ve **tabletin ekranını paylaşmak** için açık kaynak mobil uygulama.

Mobil tarayıcılar (Chrome Android, Safari iOS) `getDisplayMedia` desteklemediği için tabletten tarayıcıyla ekran paylaşılamaz. Derslik, BigBlueButton'u bir WebView içinde açar. Ekran yakalamayı native tarafta yapar ve görüntüyü doğrudan BigBlueButton'un medya sunucusuna (bbb-webrtc-sfu) gönderir. Bunun için BigBlueButton web istemcisinin mobil uygulamalar için sunduğu köprüyü kullanır.

> **Durum:** Erken geliştirme aşamasında. Şu an sadece Android hedefleniyor, iOS desteği daha sonra eklenecek.

## Gereksinimler

| Araç | Sürüm |
|---|---|
| Node.js | 20.19+ (22 LTS ile test edildi) |
| JDK | 17 veya 21 |
| Android SDK | Platform 36, Build-Tools 36, NDK 27.1 (Gradle eksik olanları otomatik indirir) |
| Cihaz | Android 7.0 (API 24) veya üstü, USB hata ayıklama açık |

Teknoloji yığını: Expo SDK 58, React Native 0.88, TypeScript, Expo Router.

## Kurulum ve çalıştırma

```bash
npm install
cp .env.example .env.local   # EXPO_PUBLIC_PORTAL_URL: uygulamanın açılışta göstereceği site
npm run android        # android/ klasörünü üretir, derler, bağlı cihaza kurar ve Metro'yu başlatır
```

Uygulama açılınca `EXPO_PUBLIC_PORTAL_URL` adresini (öğretmenlerin giriş yapıp oda başlattığı site, örneğin Greenlight) doğrudan açar. Adres derleme sırasında uygulamaya gömülür. Değiştirdikten sonra Metro'yu `npx expo start --clear` ile yeniden başlatın.

`android/` ve `ios/` klasörleri **üretilen** klasörlerdir ve repoya eklenmez (Expo Continuous Native Generation). Elle değiştirmeyin. Native ayarlar `app.config.ts`, `brand.json` ve config plugin'lerde tutulur. Yapılandırma değiştiğinde klasörü yeniden üretmek için:

```bash
npm run prebuild
```

Bağlı cihazları görmek için `adb devices` komutunu kullanabilirsiniz.

## Release APK

Release derlemeleri, proje kökündeki `keystore.properties` dosyasında tanımlı anahtarla imzalanır. Bu dosya ve anahtar repoya eklenmez. Dosya yoksa release, debug anahtarıyla imzalanır.

1. Anahtar oluşturun (bir kez yapılır):

   ```bash
   mkdir -p credentials
   keytool -genkeypair -v -storetype PKCS12 -keystore credentials/derslik-release.jks \
     -alias derslik -keyalg RSA -keysize 4096 -validity 10000
   ```

2. Proje kökünde `keystore.properties` dosyasını oluşturun:

   ```properties
   storeFile=credentials/derslik-release.jks
   storePassword=...
   keyAlias=derslik
   keyPassword=...
   ```

3. Derleyin:

   ```bash
   npm run build:apk      # çıktı: dist/derslik-<sürüm>.apk (yalnızca ARM: armeabi-v7a, arm64-v8a)
   ```

> ⚠️ Anahtarı ve şifreleri repo dışında yedekleyin. Anahtar kaybolursa yeni sürümler eski kurulumların üzerine kurulamaz; kullanıcıların uygulamayı silip yeniden kurması gerekir. Play Store'da yayınlamak için ayrıca `./gradlew bundleRelease` ile AAB üretilir.

Yeni sürüm çıkarmadan önce `app.config.ts` içindeki `version` alanını ve `android.versionCode` değerini artırın.

## Markalama

Uygulama adı, paket adı (`applicationId`), URL şeması, renkler ve ikon yolları tek bir dosyada tutulur: [`brand.json`](brand.json).

1. `brand.json` dosyasını düzenleyin.
2. Geçici ikonları renklerden yeniden üretmek için `npm run icons` çalıştırın. Bu adım Pillow gerektirir. Gerçek tasarım varsa PNG dosyalarını `assets/brand/` altına koymanız yeterli.
3. `npm run prebuild && npm run android`

## Lisans

Bu proje **GNU Lesser General Public License v3.0** (LGPL-3.0-only) ile lisanslanmıştır. Lisans metinleri [`COPYING.LESSER`](COPYING.LESSER) (LGPL-3.0) ve [`COPYING`](COPYING) (GPL-3.0; LGPL bu metne atıfla tanımlanır) dosyalarındadır.

LGPL-3.0'ın pratikte anlamı:

- Uygulamayı (APK, AAB veya IPA olarak) dağıttığınızda, kullanıcılara bu projenin **kaynak koduna erişim** sağlamalısınız. Repo bağlantısı vermek yeterlidir.
- Bu projenin dosyalarında yaptığınız değişiklikler de LGPL-3.0 altında yayımlanmalıdır.
- Lisans ve telif bildirimleri korunmalıdır.

Referans alınan projeler:

- [BigBlueButton](https://github.com/bigbluebutton/bigbluebutton) (LGPL-3.0): uygulama, `bigbluebutton-html5/imports/ui/services/mobile-app` altındaki WebView ↔ native köprü protokolüne uyar.
- [`bigbluebutton-tablet-sdk`](https://www.npmjs.com/package/bigbluebutton-tablet-sdk) (npm 0.1.35): `package.json` dosyasında LGPL-3.0, `LICENSE` dosyasında MIT yazıyor. Bu koddan alınan parçalar dosya başlarında belirtilir.
- [`bigbluebutton-mobile`](https://github.com/bigbluebutton/bigbluebutton-mobile): lisans dosyası yok. Bu repodan **kod kopyalanmamıştır**, sadece mimari referans olarak incelenmiştir.

"BigBlueButton" BigBlueButton Inc.'in ticari markasıdır. Bu proje BigBlueButton Inc. ile bağlantılı değildir.
