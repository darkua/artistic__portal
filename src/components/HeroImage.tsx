import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface HeroImageProps {
  images?: string[]
  alt?: string
  autoPlay?: boolean
  autoPlayInterval?: number
}

export default function HeroImage({ 
  images, 
  alt = 'Hero image',
  autoPlay = true,
  autoPlayInterval = 5000
}: HeroImageProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const imageList = images && images.length > 0 ? images : ['/placeholder-hero.jpg']

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % imageList.length)
  }

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + imageList.length) % imageList.length)
  }

  // Auto-play functionality
  useEffect(() => {
    if (imageList.length <= 1 || !autoPlay) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % imageList.length)
    }, autoPlayInterval)

    return () => clearInterval(interval)
  }, [imageList.length, autoPlay, autoPlayInterval])

  if (imageList.length === 1) {
    return (
      <div className="w-full h-screen lg:h-full lg:min-h-screen relative overflow-hidden flex items-center justify-center">
        <img
          src={imageList[0]}
          alt={alt}
          className="object-contain"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
            const parent = target.parentElement
            if (parent) {
              parent.innerHTML = `
                <div class="w-full h-full flex items-center justify-center bg-gray-200">
                  <span class="text-gray-400 text-sm">${alt}</span>
                </div>
              `
            }
          }}
        />
      </div>
    )
  }

  return (
    <div className="w-full h-screen lg:h-full lg:min-h-screen relative overflow-hidden group">
      {/* Images container with fade transition */}
      <div className="relative w-full h-full flex items-center justify-center">
        {imageList.map((img, index) => (
          <img
            key={index}
            src={img}
            alt={`${alt} - ${index + 1}`}
            className={`absolute object-contain transition-opacity duration-700 ${
              index === currentIndex ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }}
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
            }}
          />
        ))}
      </div>

      {/* Navigation buttons */}
      {imageList.length > 1 && (
        <>
          <button
            onClick={prevImage}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/20 hover:bg-black/40 text-white transition-all opacity-0 group-hover:opacity-100 rounded-full backdrop-blur-sm"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={nextImage}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/20 hover:bg-black/40 text-white transition-all opacity-0 group-hover:opacity-100 rounded-full backdrop-blur-sm"
            aria-label="Next image"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          
          {/* Dots indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
            {imageList.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`h-2 w-2 rounded-full transition-all ${
                  index === currentIndex 
                    ? 'bg-white w-6' 
                    : 'bg-white/50 hover:bg-white/75'
                }`}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

