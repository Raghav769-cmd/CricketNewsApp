'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const heroSlides = [
    {
      title: 'Live Match Updates',
      subtitle: 'Experience cricket like never before',
      description: 'Real-time ball-by-ball commentary and comprehensive match insights',
      cta: 'Watch Live',
      href: '/matches',
      linear: 'from-teal-600 via-teal-700 to-cyan-800',
      imageUrl: 'https://analyticsstepsfiles.s3.ap-south-1.amazonaws.com/backend/media/thumbnail/9021667/2895719_1611999733_title-bannerArtboard-1.png',
    },
    {
      title: 'Team Analytics',
      subtitle: 'Deep dive into team performance',
      description: 'Comprehensive statistics and insights for all cricket teams',
      cta: 'Explore Teams',
      href: '/teams',
      linear: 'from-purple-600 via-purple-700 to-indigo-800',
      imageUrl: 'https://elearn.nptel.ac.in/wp-content/uploads/2024/01/Cricket-Data-analysis-copy.jpg',
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  const features = [
    {
      title: 'Live Matches',
      description: 'Follow live cricket matches with real-time ball-by-ball updates and scores',
      href: '/matches',
      color: 'from-lime-400 to-lime-500',
      textColor: 'text-lime-400',
      borderColor: 'border-lime-500',
      bgColor: 'bg-slate-900',
    },
    {
      title: 'Teams',
      description: 'Explore cricket teams and their performance statistics',
      href: '/teams',
      color: 'from-lime-400 to-lime-500',
      textColor: 'text-lime-400',
      borderColor: 'border-lime-500',
      bgColor: 'bg-slate-900',
    },
  ];

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Slider Section */}
      <div className="relative mt-px h-[300px] sm:h-[450px] md:h-[550px] lg:h-[650px] overflow-hidden">
        {/* Background slides */}
        {heroSlides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentSlide ? 'opacity-300' : 'opacity-0'
            }`}
          >
            {/* Background - Image or linear */}
            {slide.imageUrl ? (
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${slide.imageUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              ></div>
            ) : (
              <div className={`absolute inset-0 bg-linear-to-r ${slide.linear}`}></div>
            )}
            
            {/* Darker overlay for readability when using images */}
            {slide.imageUrl && (
              <div className="absolute inset-0 bg-black/50"></div>
            )}
            
            {/* Pattern overlay - for linear backgrounds only */}
            {!slide.imageUrl && (
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                  backgroundImage: `radial-linear(circle at 2px 2px, white 1px, transparent 0)`,
                  backgroundSize: '40px 40px'
                }}></div>
              </div>
            )}

            {/* Animated shapes - hidden on mobile */}
            <div className="hidden sm:block absolute top-10 right-10 sm:top-16 sm:right-16 w-32 sm:w-48 md:w-64 h-32 sm:h-48 md:h-64 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
            <div className="hidden sm:block absolute bottom-10 left-10 sm:bottom-16 sm:left-16 w-40 sm:w-56 md:w-80 h-40 sm:h-56 md:h-80 bg-white/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
          </div>
        ))}

        {/* Content */}
        <div className="relative z-10 h-full flex items-center">
          <div className="container mx-auto px-4 w-full">
            {heroSlides.map((slide, index) => (
              <div
                key={index}
                className={`transition-all duration-700 ${
                  index === currentSlide
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-10 absolute'
                }`}
              >
                <div className="max-w-3xl">
                  <div className="inline-block mb-2 sm:mb-4">
                    <span className="px-3 py-1 sm:px-4 sm:py-2 bg-white/20 backdrop-blur-sm rounded-full text-xs sm:text-sm font-medium text-white border border-white/30">
                      {slide.subtitle}
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-7xl font-bold text-white mb-3 sm:mb-6 tracking-tight leading-tight">
                    {slide.title}
                  </h1>
                  <p className="text-sm sm:text-lg md:text-xl lg:text-2xl text-white/90 mb-4 sm:mb-8 leading-relaxed">
                    {slide.description}
                  </p>
                  <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-4">
                    <Link
                      href={slide.href}
                      className="inline-flex items-center justify-center bg-white text-gray-900 px-4 sm:px-8 py-3 sm:py-4 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base lg:text-lg hover:bg-gray-100 transition-all duration-200 shadow-lg sm:shadow-2xl hover:shadow-xl sm:hover:shadow-3xl transform hover:scale-105 w-full sm:w-auto"
                    >
                      {slide.cta}
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </Link>
                    <button className="inline-flex items-center justify-center bg-white/10 backdrop-blur-sm text-white px-4 sm:px-8 py-3 sm:py-4 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base lg:text-lg hover:bg-white/20 transition-all duration-200 border-2 border-white/30 w-full sm:w-auto">
                      Explore
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Slide indicators */}
        <div className="absolute bottom-4 sm:bottom-8 left-1/2 transform -translate-x-1/2 z-20 flex space-x-2 sm:space-x-3">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`rounded-full transition-all duration-300 ${
                index === currentSlide
                  ? 'bg-white w-6 sm:w-8 h-2 sm:h-3'
                  : 'w-2 sm:w-3 h-2 sm:h-3 bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        {/* Navigation arrows - hidden on mobile */}
        <button
          onClick={() => setCurrentSlide((currentSlide - 1 + heroSlides.length) % heroSlides.length)}
          className="hidden sm:flex absolute left-2 sm:left-4 top-1/2 transform -translate-y-1/2 z-20 w-8 h-8 sm:w-12 sm:h-12 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-full items-center justify-center transition-all duration-200 border border-white/30"
          aria-label="Previous slide"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={() => setCurrentSlide((currentSlide + 1) % heroSlides.length)}
          className="hidden sm:flex absolute right-2 sm:right-4 top-1/2 transform -translate-y-1/2 z-20 w-8 h-8 sm:w-12 sm:h-12 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-full items-center justify-center transition-all duration-200 border border-white/30"
          aria-label="Next slide"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="container mx-auto px-4 py-8 sm:py-12 md:py-20">
        <div className="text-center mb-8 sm:mb-12 md:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 sm:mb-4">
            Comprehensive Cricket Management
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-400 max-w-2xl mx-auto px-2">
            Everything you need to track, manage, and analyze cricket matches in real-time
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 max-w-7xl mx-auto">
          {features.map((feature, index) => (
            <Link
              key={index}
              href={feature.href}
              className="group relative"
            >
              <div className={`bg-slate-900 rounded-lg sm:rounded-2xl border-2 ${feature.borderColor} hover:border-lime-400 transition-all duration-300 p-4 sm:p-6 md:p-8 h-full transform hover:-translate-y-2 hover:shadow-2xl shadow-lg`}>
                <div className={`absolute top-0 right-0 w-20 h-20 sm:w-32 sm:h-32 bg-linear-to-br ${feature.color} opacity-10 rounded-bl-full`}></div>
                
                <div className={`w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-linear-to-br ${feature.color} rounded-lg sm:rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                
                <h3 className={`text-lg sm:text-xl md:text-2xl font-bold mb-2 sm:mb-3 ${feature.textColor} group-hover:${feature.textColor} transition-colors`}>
                  {feature.title}
                </h3>
                
                <p className="text-gray-400 leading-relaxed mb-4 sm:mb-6 text-sm sm:text-base">
                  {feature.description}
                </p>
                
                <div className={`inline-flex items-center ${feature.textColor} font-semibold group-hover:gap-3 gap-2 transition-all duration-200 text-sm sm:text-base`}>
                  <span>Explore</span>
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      {/* The End Section */}
      <div className="py-8 sm:py-12 md:py-14 bg-linear-to-br from-black via-slate-950 to-black">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 sm:mb-3">Why Choose CricketLive</h2>
            <p className="text-base sm:text-lg text-gray-400">Experience the future of cricket management</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 max-w-6xl mx-auto">
            <div className="group relative">
              <div className="absolute inset-0 bg-linear-to-r from-lime-400 to-lime-500 rounded-lg sm:rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur"></div>
              <div className="relative bg-slate-900 rounded-lg sm:rounded-2xl p-4 sm:p-6 md:p-8 h-full border-2 border-slate-800 hover:border-lime-400 transition-all duration-300">
                <div className="w-14 h-12 sm:w-16 sm:h-14 bg-linear-to-br from-lime-400 to-lime-500 rounded-lg sm:rounded-xl flex items-center justify-center mb-3 sm:mb-4 text-black font-bold text-sm sm:text-lg">
                  LIVE
                </div>
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-2 sm:mb-3">Live Coverage</h3>
                <p className="text-gray-400 text-sm sm:text-base">Real-time match updates and comprehensive ball-by-ball commentary</p>
              </div>
            </div>
            
            <div className="group relative">
              <div className="absolute inset-0 bg-linear-to-r from-lime-400 to-lime-500 rounded-lg sm:rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur"></div>
              <div className="relative bg-slate-900 rounded-lg sm:rounded-2xl p-4 sm:p-6 md:p-8 h-full border-2 border-slate-800 hover:border-lime-400 transition-all duration-300">
                <div className="w-14 h-12 sm:w-16 sm:h-14 bg-linear-to-br from-lime-400 to-lime-500 rounded-lg sm:rounded-xl flex items-center justify-center mb-3 sm:mb-4 text-black font-bold text-sm sm:text-lg">
                  FAST
                </div>
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-2 sm:mb-3">Lightning Fast</h3>
                <p className="text-gray-400 text-sm sm:text-base">Instant updates with blazing-fast performance for seamless experience</p>
              </div>
            </div>
            
            <div className="group relative">
              <div className="absolute inset-0 bg-linear-to-r from-lime-400 to-lime-500 rounded-lg sm:rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur"></div>
              <div className="relative bg-slate-900 rounded-lg sm:rounded-2xl p-4 sm:p-6 md:p-8 h-full border-2 border-slate-800 hover:border-lime-400 transition-all duration-300">
                <div className="w-16 h-12 sm:w-20 sm:h-14 bg-linear-to-br from-lime-400 to-lime-500 rounded-lg sm:rounded-xl flex items-center justify-center mb-3 sm:mb-4 text-black font-bold text-xs sm:text-sm md:text-lg">
                  DETAIL
                </div>
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-2 sm:mb-3">Detailed Analytics</h3>
                <p className="text-gray-400 text-sm sm:text-base">In-depth statistics and insights for smarter decision making</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 