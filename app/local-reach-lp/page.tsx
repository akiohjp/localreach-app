"use client";

import React from 'react';
import DiagnosisQuiz from '@/components/lp/DiagnosisQuiz';
import { 
  Star, 
  Zap, 
  ShieldCheck, 
  Smartphone, 
  ArrowRight,
  CheckCircle2,
  MousePointerClick,
  BarChart2,
  Search
} from 'lucide-react';

const LocalReachLP = () => {
  return (
    <div className="min-h-screen bg-[#FDFDFD] text-gray-900 font-sans selection:bg-gold-100 overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-black flex items-center justify-center rounded-lg shadow-lg rotate-3 transition-transform hover:rotate-0 cursor-pointer">
              <span className="text-white font-bold text-2xl">L</span>
            </div>
            <span className="text-2xl font-black tracking-tighter">LocalReach</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-bold">
            <a href="#diagnosis" className="hover:text-[#D4AF37] transition-colors">Consultation</a>
            <a href="#features" className="hover:text-[#D4AF37] transition-colors">Features</a>
            <a href="#pricing" className="hover:text-[#D4AF37] transition-colors">Pricing</a>
            <button className="bg-[#D4AF37] text-white px-8 py-3 rounded-full font-bold hover:bg-[#B8962E] transition-all transform hover:scale-105 shadow-lg shadow-gold-400/20">
              Book a Demo
            </button>
          </div>
        </div>
      </nav>

      {/* 1. Hero Section */}
      <section className="relative pt-32 pb-12 md:pt-40 md:pb-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center relative z-10">
          <div className="text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37] text-sm font-bold uppercase tracking-widest animate-fade-in">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4AF37] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D4AF37]"></span>
              </span>
              AI-Powered Local SEO Solution
            </div>
            <h1 className="text-5xl md:text-[80px] font-black tracking-tight mb-8 leading-[1.0] text-gray-900">
              Rule Your Area <br />
              with <span className="text-[#D4AF37]">AI</span>.
            </h1>
            <p className="text-xl md:text-2xl font-semibold text-gray-700 max-w-xl leading-relaxed">
              Automated Google Reviews & Private Customer List Building.
            </p>
            <p className="text-lg font-medium text-gray-600 max-w-xl mt-4 leading-relaxed">
              Transform your restaurant&apos;s digital presence in Dubai. Start for 500 AED/month. The ultimate Local SEO & GEO strategy.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-6 pt-4">
              <button className="w-full sm:w-auto bg-[#D4AF37] text-white px-12 py-6 rounded-2xl text-xl font-black shadow-2xl shadow-gold-600/40 hover:bg-[#B8962E] transition-all transform hover:-translate-y-1 flex items-center justify-center gap-3">
                Book a Free Demo <ArrowRight size={24} />
              </button>
              <div className="flex items-center gap-4">
                <div className="flex -space-x-3">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-gray-200" />
                  ))}
                </div>
                <p className="text-sm font-bold text-gray-600 uppercase tracking-tight">Trusted by 500+ outlets in UAE</p>
              </div>
            </div>
          </div>
          
          {/* iPhone Mockup with Google Review UI */}
          <div className="relative group lg:ml-12 flex justify-center">
            <div className="absolute inset-0 bg-[#D4AF37]/20 rounded-[40px] blur-[80px] -z-10 group-hover:bg-[#D4AF37]/30 transition-all duration-700" />
            
            <div className="w-[300px] h-[600px] bg-gray-900 rounded-[55px] p-3 shadow-2xl relative border-[4px] border-gray-800">
               <div className="w-full h-full bg-white rounded-[45px] overflow-hidden relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-900 rounded-b-2xl z-20" />
                  
                  <div className="pt-10 px-6 pb-4 border-b border-gray-100">
                     <div className="w-full h-8 bg-gray-100 rounded-full mb-4 flex items-center px-4">
                        <div className="w-3 h-3 bg-[#D4AF37] rounded-full mr-2" />
                        <div className="w-20 h-2 bg-gray-200 rounded-full" />
                     </div>
                  </div>

                  <div className="p-6 space-y-6 text-left">
                     <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xl">J</div>
                        <div>
                           <p className="font-bold text-sm">John Doe</p>
                           <p className="text-[10px] text-gray-400">Local Guide • 12 reviews</p>
                        </div>
                     </div>
                     <div className="flex text-[#D4AF37]">
                        {[1,2,3,4,5].map(i => <Star key={i} size={16} fill="currentColor" />)}
                     </div>
                     <p className="text-sm font-medium leading-relaxed text-gray-800">
                        &ldquo;Absolutely amazing experience! The Wagyu Burger was cooked to perfection and the AI-generated review made it so easy to share my thoughts. Highly recommend this place!&rdquo;
                     </p>
                     <div className="grid grid-cols-2 gap-2">
                        <div className="aspect-square bg-gray-100 rounded-xl" />
                        <div className="aspect-square bg-gray-100 rounded-xl" />
                     </div>

                     <div className="mt-8 p-4 bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-2xl">
                        <div className="flex items-center gap-2 mb-1">
                           <Zap size={12} className="text-[#D4AF37]" />
                           <span className="text-[10px] font-bold text-[#D4AF37] uppercase">LocalReach AI</span>
                        </div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase">GEO Search Optimization Active</p>
                     </div>
                  </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#D4AF37]/5 rounded-full blur-[100px] -z-10 translate-x-1/2 -translate-y-1/2" />
      </section>

      {/* 2. Diagnosis Section (Focused & Dense) */}
      <section id="diagnosis" className="py-12 md:py-20 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-[#D4AF37] font-black text-sm uppercase tracking-[0.2em] mb-4 block">Self-Assessment</span>
              <h2 className="text-4xl md:text-5xl font-black mb-8 leading-tight">
                あなたのお店の「集客力」を<br />
                1分で完全可視化。
              </h2>
              <p className="text-lg text-gray-500 font-medium mb-8 leading-relaxed">
                ドバイの飲食店が陥りやすい「機会損失」をチェック。診断結果に基づいた個別のMEO戦略シートを無料で進呈します。
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {["4つの質問に答えるだけ", "現在のスコアを算出", "具体的な改善点を提示", "100% 無料診断"].map((text, i) => (
                   <li key={i} className="flex items-center gap-3 font-bold text-gray-700 bg-white p-4 rounded-xl shadow-sm">
                     <div className="bg-[#D4AF37] rounded-full p-1 flex-shrink-0"><CheckCircle2 size={16} className="text-white" /></div>
                     <span className="text-sm">{text}</span>
                   </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-white/50 blur-xl -z-10 rounded-[40px]" />
              <DiagnosisQuiz />
            </div>
          </div>
        </div>
      </section>

      {/* 3. Education Section (Rich visual) */}
      <section className="py-24 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1 space-y-8">
               <h2 className="text-4xl md:text-6xl font-black leading-[1.1]">
                 なぜ今、<br /><span className="text-[#D4AF37]">Local SEO / GEO</span>なのか？
               </h2>
               <div className="space-y-6">
                 {[
                   { title: "検索のAI化", desc: "顧客の90%はマップ検索やAI検索（GEO）からお店を決定しています。" },
                   { title: "星の数＝売上", desc: "上位表示されることで、広告費ゼロで安定した新規客を獲得できます。" }
                 ].map((item, i) => (
                   <div key={i} className="flex gap-6 items-start p-6 rounded-3xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                     <div className="text-4xl font-black text-[#D4AF37]/20">{String(i+1).padStart(2, '0')}</div>
                     <div>
                       <h3 className="text-2xl font-black mb-2">{item.title}</h3>
                       <p className="text-gray-500 font-medium leading-relaxed">{item.desc}</p>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
            <div className="flex-1 w-full">
              <div className="bg-black rounded-[40px] p-12 text-white relative">
                 <Search size={48} className="text-[#D4AF37] mb-8" />
                 <h4 className="text-3xl font-black mb-6 italic">&ldquo;Where is the best burger in Dubai?&rdquo;</h4>
                 <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white/10 rounded-2xl border border-[#D4AF37]/50 shadow-lg shadow-gold-500/20 transform -translate-x-4">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-[#D4AF37] rounded-lg" />
                         <span className="font-bold">Your Restaurant</span>
                       </div>
                       <div className="flex text-[#D4AF37]"><Star size={12} fill="currentColor" /> <Star size={12} fill="currentColor" /> <Star size={12} fill="currentColor" /> <Star size={12} fill="currentColor" /> <Star size={12} fill="currentColor" /></div>
                    </div>
                    {[1,2].map(i => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl opacity-40">
                         <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-gray-500 rounded-lg" />
                           <span className="font-bold text-gray-400">Competitor {i}</span>
                         </div>
                         <div className="flex text-gray-600"><Star size={12} fill="currentColor" /> <Star size={12} fill="currentColor" /> <Star size={12} fill="currentColor" /></div>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Solution Section (Richer, Larger Icons) */}
      <section id="features" className="py-24 bg-black text-white overflow-hidden relative">
        <div className="absolute bottom-0 left-0 w-full h-[500px] bg-gradient-to-t from-[#D4AF37]/10 to-transparent pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-24">
              <h2 className="text-5xl md:text-8xl font-black mb-8 leading-tight">
                選ばれる<span className="text-[#D4AF37]">3つ</span>の理由
              </h2>
              <p className="text-xl text-gray-400 font-bold max-w-2xl mx-auto italic">
                競合他社には真似できない、圧倒的なテクノロジー。
              </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Zap size={80} className="text-[#D4AF37]" />,
                title: "AI Individual Generation",
                desc: "AIがお客様の具体的な体験を反映した文章をリアルタイム生成. 画一的なレビューを防ぎ、GoogleのAIに「価値ある店舗」と認識させます。",
                badge: "Unique Tech"
              },
              {
                icon: <Smartphone size={80} className="text-[#D4AF37]" />,
                title: "Stealth CRM Integration",
                desc: "レビューの流れで自然にWhatsApp番号を取得。お客様が気づかないうちに、最強のリピーターリストが自動構築されていきます。",
                badge: "High Growth"
              },
              {
                icon: <ShieldCheck size={80} className="text-[#D4AF37]" />,
                title: "100% Policy Compliant",
                desc: "規約違反によるアカウント停止は、店舗にとって致命傷です。クッションページを介する独自設計で、100%安全な運用を保証します。",
                badge: "Enterprise Grade"
              }
            ].map((item, i) => (
              <div key={i} className="group bg-white/5 border border-white/10 p-12 rounded-[50px] hover:bg-white/10 hover:border-[#D4AF37]/50 transition-all duration-500 flex flex-col items-center text-center">
                <div className="mb-10 transform group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500 inline-block">
                  {item.icon}
                </div>
                <div className="inline-block px-4 py-1 rounded-full border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-black uppercase tracking-widest mb-6">
                  {item.badge}
                </div>
                <h3 className="text-3xl font-black mb-6 leading-tight group-hover:text-[#D4AF37] transition-colors">{item.title}</h3>
                <p className="text-gray-400 leading-relaxed font-bold">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Simple Flow (SaaS Visual Style) */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-6xl font-black mb-24">驚くほど簡単な導入フロー</h2>
          
          <div className="grid md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-[85px] left-[10%] right-[10%] h-[4px] bg-gray-50 -z-10" />
            
            {[
              {
                icon: <MousePointerClick size={48} />,
                title: "卓上にPOPを置く",
                desc: "手間なし。今日から始められます。"
              },
              {
                icon: <Smartphone size={48} />,
                title: "お客様が3タップ",
                desc: "AIが感動的な口コミを自動生成。"
              },
              {
                icon: <BarChart2 size={48} />,
                title: "売上が加速する",
                desc: "データは自動で蓄積されます。"
              }
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center group">
                <div className="w-[170px] h-[170px] bg-white border-[8px] border-gray-50 shadow-2xl rounded-[60px] flex items-center justify-center text-[#D4AF37] mb-8 group-hover:border-[#D4AF37] transition-all duration-500 group-hover:shadow-gold-200/50">
                  <div className="transform group-hover:scale-125 transition-transform duration-500">
                    {item.icon}
                  </div>
                </div>
                <div className="bg-black text-white w-8 h-8 rounded-full flex items-center justify-center text-xs font-black mb-4">0{i+1}</div>
                <h3 className="text-2xl font-black mb-4">{item.title}</h3>
                <p className="text-gray-500 font-bold leading-tight">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Pricing Section (Condensed & High Impact) */}
      <section id="pricing" className="py-24 bg-[#0A0A0A] text-white overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 relative">
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-[#D4AF37]/20 blur-[100px] rounded-full" />
          
          <div className="text-center mb-16 relative z-10">
             <h2 className="text-5xl md:text-7xl font-black mb-6 italic tracking-tighter text-[#D4AF37]">Price.</h2>
             <p className="text-gray-400 font-black tracking-[0.3em] uppercase text-sm">One Simple Plan. Unlimited Growth.</p>
          </div>
          
          <div className="bg-gradient-to-br from-gray-900 via-black to-gray-900 rounded-[60px] border border-white/10 shadow-[0_0_100px_rgba(212,175,55,0.1)] p-10 md:p-20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-12">
               <div className="bg-[#D4AF37] text-white text-sm font-black px-6 py-2 rounded-full uppercase shadow-lg shadow-gold-500/50 animate-pulse">
                 No Commitment
               </div>
            </div>
            
            <div className="grid lg:grid-cols-2 gap-16 items-center relative z-10">
               <div className="space-y-8">
                  <div>
                    <h3 className="text-4xl font-black mb-4 tracking-tight">LocalReach All-in-One</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-8xl font-black tracking-tighter text-[#D4AF37]">500</span>
                      <span className="text-2xl font-bold text-gray-500 uppercase tracking-widest">AED / Mo</span>
                    </div>
                  </div>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 font-black text-gray-300">
                    {["初期費用 0 AED", "AIレビュー無制限", "WhatsApp CRM", "多言語対応", "MEO分析レポート", "24/7 サポート"].map((f, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <CheckCircle2 size={20} className="text-[#D4AF37] flex-shrink-0" /> <span className="text-sm">{f}</span>
                      </li>
                    ))}
                  </ul>
               </div>
               <div className="flex flex-col gap-6">
                  <button className="w-full bg-white text-black px-10 py-8 rounded-[30px] text-2xl font-black hover:bg-[#D4AF37] hover:text-white transition-all transform hover:-translate-y-2 shadow-2xl group-hover:scale-105 duration-500">
                    Get Started Now
                  </button>
                  <p className="text-center text-sm text-gray-500 font-bold px-8">
                    従業員を一人雇うコストの1/10で、<br />最強のマーケティングアシスタントを。
                  </p>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Bottom CTA (High Density) */}
      <section className="py-40 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-6xl md:text-[120px] font-black mb-16 tracking-tighter leading-[0.8] text-gray-900">
            TIME TO <br />
            <span className="text-[#D4AF37]">DOMINATE.</span>
          </h2>
          <div className="flex flex-col items-center gap-12">
            <button className="bg-black text-white px-20 py-10 rounded-full text-3xl font-black shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:bg-[#D4AF37] transition-all transform hover:scale-110 flex items-center gap-6">
              Book a Free Demo <ArrowRight size={40} />
            </button>
            <div className="flex flex-wrap justify-center gap-12 text-sm font-black text-gray-200 uppercase tracking-[0.5em]">
              <span>Powerful</span>
              <span>Proven</span>
              <span>Fast</span>
            </div>
          </div>
        </div>
        {/* Background Text */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[300px] font-black text-gray-50 opacity-[0.02] select-none pointer-events-none uppercase">
          LocalReach
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-20 text-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-12 border-t border-white/10 pt-20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#D4AF37] flex items-center justify-center rounded-2xl shadow-lg shadow-gold-500/20">
              <span className="text-white font-black text-2xl">L</span>
            </div>
            <span className="text-3xl font-black tracking-tighter">LocalReach</span>
          </div>
          <div className="flex gap-8 text-sm font-bold text-gray-500 uppercase tracking-widest">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
          <div className="text-sm font-bold text-gray-500">
            © 2024 AI Company Core. Powered by AIO.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LocalReachLP;

