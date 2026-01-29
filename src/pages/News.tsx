import { useTranslation } from '../hooks/useTranslation'
import EditableText from '../components/EditableText'

export default function News() {
  const { t, language } = useTranslation()
  const lang = language as 'en' | 'es'

  return (
    <div className="w-full">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light mb-4 sm:mb-6">
          {t('news.title')}
        </h1>

        {/* Description (editable via translations through admin mode) */}
        <div className="max-w-4xl mb-10 sm:mb-12">
          <EditableText
            dataPath={`news.description.${lang}`}
            language={lang}
            className="text-base sm:text-lg leading-relaxed opacity-90 whitespace-pre-line"
            as="p"
            multiline
          >
            {t('news.description')}
          </EditableText>
        </div>

        {/* Placeholder for performance works */}
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm opacity-60">
          {t('news.placeholder')}
        </div>
      </div>
    </div>
  )
}

