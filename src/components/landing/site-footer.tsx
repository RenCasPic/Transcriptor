import Link from 'next/link';
import { getDictionary } from '@/lib/i18n/get-dictionary';

/** Pie público (landing y /precios). */
export async function SiteFooter() {
  const { dictionary: t } = await getDictionary();

  return (
    <footer className="border-t py-8">
      <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
        <p>
          © {new Date().getFullYear()} {t.common.appName}. {t.landing.footerRights}
        </p>
        <div className="flex gap-4">
          <Link href="/precios" className="hover:text-foreground">
            {t.landing.pricingNav}
          </Link>
          <Link href="/login" className="hover:text-foreground">
            {t.landing.signIn}
          </Link>
          <Link href="/register" className="hover:text-foreground">
            {t.auth.register.submit}
          </Link>
        </div>
      </div>
    </footer>
  );
}
