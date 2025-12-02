import Link from 'next/link';

export default function Home() {
  const features = [
    {
      title: 'Live Matches',
      description: 'Follow live cricket matches with real-time ball-by-ball updates and scores',
      icon: '🏏',
      href: '/matches',
      color: 'from-teal-500 to-teal-600',
      textColor: 'text-teal-600',
    },
    {
      title: 'Teams',
      description: 'Explore cricket teams and their performance statistics',
      icon: '👥',
      href: '/teams',
      color: 'from-purple-500 to-purple-600',
      textColor: 'text-purple-600',
    },
    {
      title: 'Live Scoring',
      description: 'Enter ball-by-ball data and manage live cricket scoring',
      icon: '📊',
      href: '/ball-entry',
      color: 'from-orange-500 to-orange-600',
      textColor: 'text-orange-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Hero Section */}
      <div className="gradient-primary text-white py-20 px-4">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 animate-fade-in">
            Welcome to CricketLive
          </h1>
          <p className="text-xl md:text-2xl text-teal-50 mb-8 max-w-2xl mx-auto">
            Your ultimate destination for live cricket scores, match insights, and real-time updates
          </p>
          <Link
            href="/matches"
            className="inline-block bg-white text-teal-700 px-8 py-3 rounded-full font-semibold text-lg hover:bg-teal-50 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            View Live Matches
          </Link>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
          Explore Features
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <Link
              key={index}
              href={feature.href}
              className="group"
            >
              <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 h-full transform hover:-translate-y-2">
                <div className={`w-16 h-16 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  {feature.icon}
                </div>
                
                <h3 className={`text-2xl font-bold mb-4 ${feature.textColor}`}>
                  {feature.title}
                </h3>
                
                <p className="text-gray-600 leading-relaxed mb-4">
                  {feature.description}
                </p>
                
                <div className={`inline-flex items-center ${feature.textColor} font-semibold group-hover:translate-x-2 transition-transform duration-200`}>
                  Explore <span className="ml-2">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 text-center max-w-4xl mx-auto">
            <div>
              <div className="text-4xl font-bold text-teal-600 mb-2">Live</div>
              <div className="text-gray-600">Real-time Updates</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-purple-600 mb-2">Fast</div>
              <div className="text-gray-600">Ball-by-Ball Coverage</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-orange-600 mb-2">Detailed</div>
              <div className="text-gray-600">Match Insights</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}