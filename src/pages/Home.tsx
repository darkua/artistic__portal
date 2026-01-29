import { useEffect, useState } from 'react'
import { useTranslation } from '../hooks/useTranslation'
import HeroImage from '../components/HeroImage'
import portfolioData from '../data/portfolioData.json'
import EditableText from '../components/EditableText'

export default function Home() {
  const { language } = useTranslation()
  const lang = language as 'en' | 'es'
  const home = (portfolioData as any).home

  const initialFavorites = (home && Array.isArray(home.favorites)) ? home.favorites : []
  const [heroImages, setHeroImages] = useState<string[]>(initialFavorites)

  // Load live favorites from backend so changes from hearts appear on reload
  useEffect(() => {
    let isMounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/favorites')
        if (!res.ok) return
        const data = await res.json()
        if (isMounted && Array.isArray(data.favorites)) {
          setHeroImages(data.favorites)
        }
      } catch {
        // fail silently, fall back to JSON favorites
      }
    })()
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="w-full">
      {/* Mobile: Text first, then slideshow */}
      <div className="lg:hidden">
        <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="space-y-6">
            <EditableText
              dataPath="home.title"
              language={lang}
              className="text-4xl sm:text-5xl font-light tracking-tight"
              as="h1"
            >
              {home.title[lang]}
            </EditableText>
            <div className="prose prose-sm max-w-none">
              <EditableText
                dataPath="home.introduction"
                language={lang}
                className="text-base leading-relaxed opacity-90 whitespace-pre-line"
                as="p"
                multiline
              >
                {home.introduction[lang]}
              </EditableText>
            </div>
          </div>
        </div>
        <HeroImage 
          images={heroImages}
          alt={home.title[lang]}
        />
      </div>

      {/* Desktop: Split layout - Text left (1/3), Slideshow right (2/3) */}
      <div className="hidden lg:flex w-full min-h-screen">
        {/* Text Section - 1/3 width */}
        <div className="w-full lg:w-1/3 flex items-center border-r border-border">
          <div className="w-full px-8 lg:px-12 py-12 lg:py-16">
            <div className="space-y-6 max-w-xl">
              <EditableText
                dataPath="home.title"
                language={lang}
                className="text-4xl lg:text-5xl font-light tracking-tight"
                as="h1"
              >
                {home.title[lang]}
              </EditableText>
              <div className="prose prose-sm max-w-none">
                <EditableText
                  dataPath="home.introduction"
                  language={lang}
                  className="text-base leading-relaxed opacity-90 whitespace-pre-line"
                  as="p"
                  multiline
                >
                  {home.introduction[lang]}
                </EditableText>
              </div>
            </div>
          </div>
        </div>

        {/* Slideshow Section - 2/3 width */}
        <div className="w-full lg:w-2/3 flex-shrink-0">
          <HeroImage 
            images={heroImages}
            alt={home.title[lang]}
          />
        </div>
      </div>
    </div>
  )
}

