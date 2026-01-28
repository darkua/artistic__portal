import { useTranslation } from '../hooks/useTranslation'
import HeroImage from '../components/HeroImage'

export default function Home() {
  const { t } = useTranslation()

  // Hero images for slideshow
  const heroImages = [
    'https://scontent-lis1-1.xx.fbcdn.net/v/t39.30808-6/490716587_1215278210599724_1005547155084000636_n.jpg?_nc_cat=111&ccb=1-7&_nc_sid=127cfc&_nc_ohc=hPgtx67xxCoQ7kNvwE1lool&_nc_oc=Adl-pSp3UXqxTEdV_M306DfldVoyBuSTN7q6OHQo_5kxH48ci7WenOzdcIwGDlEasO0&_nc_zt=23&_nc_ht=scontent-lis1-1.xx&_nc_gid=zcPqUnF7dL60115iJ1NRqA&oh=00_AfqCaoFoXmoZAE7DiNKlq3FquWNxd0n8Cw9LqgNBgA7GJA&oe=697F31E1',
    'https://scontent-lis1-1.xx.fbcdn.net/v/t39.30808-6/490513789_1215278017266410_4454915368119844634_n.jpg?_nc_cat=100&ccb=1-7&_nc_sid=127cfc&_nc_ohc=AWEcg22QmoIQ7kNvwHb3oFi&_nc_oc=AdlloRsEPvj904T4e_mP7mnSVGN-ncwMXsi6GHhS5wn_tQT4wm7ZLXs3pjmH6eUwOj4&_nc_zt=23&_nc_ht=scontent-lis1-1.xx&_nc_gid=mfo6WjvVtnPgLeZ_Cji18g&oh=00_AfrqU7Fo-sXu3rcUk14fVOW2dW3n_JMMOxG0FJrQukiP2A&oe=697F15F1',
    'https://scontent-lis1-1.xx.fbcdn.net/v/t39.30808-6/489821925_1215277967266415_5500029574669410184_n.jpg?_nc_cat=110&ccb=1-7&_nc_sid=127cfc&_nc_ohc=z1oAa_vDwtUQ7kNvwFPxKTv&_nc_oc=Adl_b95qGBDvDqg4hwCtk16WJfp8OvzrngbJVLlR1uqGbMRwonC2H5h3JtGuUg9mXa4&_nc_zt=23&_nc_ht=scontent-lis1-1.xx&_nc_gid=M7OqbkTEZjTh7dnUWdiCMw&oh=00_AfrmHpz0um8J8shqyWWdFXAcC6EnsEJJFXarKOCSchxlBw&oe=697F14F4',
    // Add more Facebook image URLs here as needed
  ]

  return (
    <div className="w-full">
      {/* Mobile: Text first, then slideshow */}
      <div className="lg:hidden">
        <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="space-y-6">
            <h1 className="text-4xl sm:text-5xl font-light tracking-tight">
              {t('home.title')}
            </h1>
            <div className="prose prose-sm max-w-none">
              <p className="text-base leading-relaxed opacity-90 whitespace-pre-line">
                {t('home.introduction')}
              </p>
            </div>
          </div>
        </div>
        <HeroImage 
          images={heroImages}
          alt={t('home.title')}
        />
      </div>

      {/* Desktop: Split layout - Text left (1/3), Slideshow right (2/3) */}
      <div className="hidden lg:flex w-full min-h-screen">
        {/* Text Section - 1/3 width */}
        <div className="w-full lg:w-1/3 flex items-center border-r border-border">
          <div className="w-full px-8 lg:px-12 py-12 lg:py-16">
            <div className="space-y-6 max-w-xl">
              <h1 className="text-4xl lg:text-5xl font-light tracking-tight">
                {t('home.title')}
              </h1>
              <div className="prose prose-sm max-w-none">
                <p className="text-base leading-relaxed opacity-90 whitespace-pre-line">
                  {t('home.introduction')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Slideshow Section - 2/3 width */}
        <div className="w-full lg:w-2/3 flex-shrink-0">
          <HeroImage 
            images={heroImages}
            alt={t('home.title')}
          />
        </div>
      </div>
    </div>
  )
}

