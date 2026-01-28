import { useTranslation } from '../hooks/useTranslation'

export default function Footer() {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  return (
    <footer className="w-full border-t border-border mt-auto">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-sm text-center opacity-60">
          © {currentYear} {t('footer.copyright')}
        </p>
      </div>
    </footer>
  )
}

