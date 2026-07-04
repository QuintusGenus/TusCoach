import CoachMessageBanner from "@/components/CoachMessageBanner";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <CoachMessageBanner />
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            TUS Sınavına{" "}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Hazır mısın?
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            Kişiselleştirilmiş öğrenme deneyimi, binlerce soru ve detaylı
            analizlerle TUS sınavında başarıya ulaş.
          </p>
          <div className="flex justify-center gap-4">
            <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:opacity-90 transition-all hover:scale-105">
              Hemen Başla
            </button>
            <button className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-xl text-lg font-semibold hover:border-blue-600 hover:text-blue-600 transition-all">
              Demo İzle
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
              <span className="text-3xl">📚</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Soru Bankası
            </h3>
            <p className="text-gray-600">
              Tüm branşlardan binlerce güncel soru ile pratik yap.
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
              <span className="text-3xl">⏱️</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Deneme Sınavları
            </h3>
            <p className="text-gray-600">
              Gerçek sınav formatında denemelerle kendini test et.
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mb-6">
              <span className="text-3xl">📊</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Performans Analizi
            </h3>
            <p className="text-gray-600">
              Detaylı istatistiklerle zayıf noktalarını keşfet.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 py-16 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 text-center text-white">
            <div>
              <div className="text-4xl font-bold mb-2">10.000+</div>
              <div className="text-blue-100">Soru</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">500+</div>
              <div className="text-blue-100">Deneme Sınavı</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">15.000+</div>
              <div className="text-blue-100">Aktif Kullanıcı</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">%85</div>
              <div className="text-blue-100">Başarı Oranı</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
