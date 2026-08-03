import { Upload, Sparkles, PenLine, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Mini animaciones ilustrativas (CSS puro) de cada paso del flujo. No son
 * capturas reales de la app: sirven como referencia visual rápida mientras
 * no haya grabaciones de pantalla del producto. Se pueden reemplazar por
 * GIFs/videos reales sin cambiar el resto de la landing.
 */
const PREVIEWS = [
  {
    step: '1. Sube tu transcripción',
    frame: (
      <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-indigo-300 bg-indigo-50">
        <Upload className="h-8 w-8 animate-bounce text-indigo-500" />
      </div>
    ),
  },
  {
    step: '2. La IA arma tu artículo',
    frame: (
      <div className="flex h-32 flex-col justify-center gap-2 rounded-lg bg-violet-50 p-5">
        <div className="flex items-center gap-1.5 text-violet-500">
          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
        </div>
        <div className="h-2 w-3/4 animate-pulse rounded bg-violet-300" />
        <div className="h-2 w-full animate-pulse rounded bg-violet-300 [animation-delay:200ms]" />
        <div className="h-2 w-2/3 animate-pulse rounded bg-violet-300 [animation-delay:400ms]" />
      </div>
    ),
  },
  {
    step: '3. Edítalo a tu gusto',
    frame: (
      <div className="flex h-32 flex-col justify-center gap-2 rounded-lg bg-amber-50 p-5">
        <div className="flex items-center gap-1 text-amber-500">
          <PenLine className="h-3.5 w-3.5" />
        </div>
        <div className="h-2 w-full rounded bg-amber-200" />
        <div className="flex items-center gap-1">
          <div className="h-2 w-2/3 rounded bg-amber-300" />
          <div className="h-3.5 w-0.5 animate-pulse bg-amber-500" />
        </div>
        <div className="h-2 w-1/2 rounded bg-amber-200" />
      </div>
    ),
  },
  {
    step: '4. Revisa y publícalo',
    frame: (
      <div className="flex h-32 items-center justify-center rounded-lg bg-emerald-50">
        <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-emerald-500 text-white">
          <CheckCircle2 className="h-6 w-6" />
        </div>
      </div>
    ),
  },
];

export function StepPreviews() {
  return (
    <section className="py-20">
      <div className="container">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Míralo en acción</h2>
          <p className="mt-3 text-muted-foreground">Una vista rápida de cada paso del proceso.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PREVIEWS.map((preview) => (
            <Card key={preview.step} className="overflow-hidden">
              <div className="flex items-center gap-1.5 border-b bg-muted/40 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-rose-300" />
                <span className="h-2 w-2 rounded-full bg-amber-300" />
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
              </div>
              {preview.frame}
              <CardContent className="p-3">
                <p className="text-center text-xs font-medium text-muted-foreground">{preview.step}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
