/**
 * Transcripciones de demostración. Permiten explorar el flujo completo (Pegar
 * enlace / Subir archivo -> transcripción -> editor -> SEO -> publicación)
 * sin depender de una API de transcripción externa (modo demo, requisito 4.4/12).
 *
 * Hay tres tamaños (`DemoTranscriptLength`) para poder probar tanto casos
 * rápidos como artículos largos con scroll real en el editor. Cuál se usa se
 * decide en `DemoTranscriptionProvider` según `DEMO_TRANSCRIPT_LENGTH`.
 */

export type DemoTranscriptLength = 'short' | 'medium' | 'long';

export const DEMO_TRANSCRIPT_TITLE = 'Cómo estructurar un plan de contenidos trimestral';

export const DEMO_TRANSCRIPT_TEXT = `Marina Ortiz: Hoy quiero hablar de algo con lo que muchos equipos de marketing luchan: cómo estructurar un plan de contenidos trimestral que realmente se cumpla.

Marina Ortiz: Lo primero que hacemos en nuestro equipo es partir de tres objetivos de negocio, no de ideas de contenido sueltas. Si no hay un objetivo detrás, el contenido se vuelve ruido.

Marina Ortiz: El segundo paso es mapear esos objetivos contra las preguntas que hacen los clientes en ventas y en soporte. Ahí es donde sale el ochenta por ciento de nuestros mejores temas.

Marina Ortiz: En dos mil veintitrés, hicimos esto con un cliente de software de logística y pasamos de cuatro artículos al mes sin dirección clara, a doce artículos trimestrales alineados a etapas del embudo.

Marina Ortiz: El resultado fue un aumento del cuarenta por ciento en tráfico orgánico calificado en seis meses, medido con Google Search Console.

Marina Ortiz: Un error común es planear el contenido por formato, por ejemplo decidir hacer cinco videos y ocho artículos, en lugar de planear por etapa del cliente y luego elegir el formato.

Marina Ortiz: Nosotros dividimos cada trimestre en tres bloques de cuatro semanas. El primer bloque es investigación y validación de temas con el equipo de ventas.

Marina Ortiz: El segundo bloque es producción, y ahí aplicamos una regla simple: ningún artículo se publica sin al menos una fuente primaria o un dato verificable.

Marina Ortiz: El tercer bloque es distribución y medición, donde revisamos qué piezas están funcionando y cuáles debemos actualizar o retirar.

Marina Ortiz: Una pregunta que nos hacen seguido es cuántas personas se necesitan para sostener este proceso. Con un equipo de tres personas —una estratega, un redactor y un editor— es posible sostener doce piezas de calidad por trimestre.

Marina Ortiz: Mi recomendación final es simple: antes de escribir el primer artículo del trimestre, define cómo vas a medir si el plan funcionó. Si no puedes nombrar la métrica, probablemente el objetivo todavía no está claro.

Marina Ortiz: Eso es todo por hoy. Gracias por acompañarnos en este episodio sobre planificación de contenidos.`;

export const DEMO_TRANSCRIPT_SHORT_TITLE = 'Tres hábitos para reuniones de equipo más cortas';

export const DEMO_TRANSCRIPT_SHORT_TEXT = `Marina Ortiz: Voy a compartir tres hábitos rápidos para que las reuniones de equipo duren menos y sirvan más.

Marina Ortiz: El primero es empezar con la decisión que hay que tomar, no con el contexto. Si en los primeros dos minutos nadie sabe qué se va a decidir, la reunión ya se alargó de más.

Marina Ortiz: El segundo es que cada reunión tenga un dueño que cierra los pendientes al final, en voz alta, para que no queden flotando en el chat.

Marina Ortiz: El tercero es cancelar la reunión si se puede resolver por escrito. Nosotros probamos esto durante un mes y liberamos casi cinco horas por persona a la semana.

Marina Ortiz: Eso es todo. Tres cambios simples, sin necesidad de ninguna herramienta nueva.`;

export const DEMO_TRANSCRIPT_LONG_TITLE = 'Guía completa para migrar un blog a un sistema headless sin perder tráfico';

export const DEMO_TRANSCRIPT_LONG_TEXT = `Marina Ortiz: Bienvenidos a este episodio largo. Hoy vamos a cubrir de punta a punta cómo migramos un blog de más de dos mil artículos a un sistema headless sin perder el tráfico orgánico que tanto costó construir. Va a ser denso, así que voy a ir por partes.

Marina Ortiz: Empiezo con el contexto. El blog llevaba ocho años en un CMS tradicional, con temas y plugins acumulados, y cada cambio de diseño tardaba semanas porque todo estaba mezclado: contenido, presentación y lógica de negocio en el mismo lugar.

Marina Ortiz: La primera etapa fue auditoría de contenido. Antes de mover una sola línea de código, catalogamos las dos mil URLs: cuáles traían tráfico real, cuáles estaban duplicadas, y cuáles ya no tenían ningún valor y podían redirigirse o eliminarse.

Marina Ortiz: De esas dos mil URLs, encontramos que solo setecientas generaban el noventa por ciento del tráfico. El resto era contenido viejo, con canibalización de palabras clave entre artículos casi idénticos.

Marina Ortiz: La segunda etapa fue el mapa de redirecciones. Esto es, para nosotros, la parte más crítica de toda la migración: cada URL vieja necesita saber exactamente a dónde apunta en el sitio nuevo, con un código de estado 301, antes de que el sitio viejo se apague.

Marina Ortiz: Un error que vimos en otras migraciones fallidas es redirigir todo a la página de inicio "por simplicidad". Eso destruye el valor de SEO acumulado de cada artículo. Cada URL vieja debe ir a su equivalente más cercano en contenido, no a un genérico.

Marina Ortiz: La tercera etapa fue elegir el sistema headless en sí. Evaluamos tres opciones con los mismos criterios: tiempo de carga, facilidad para el equipo editorial, y costo de mantenimiento a tres años, no solo el costo inicial.

Marina Ortiz: Terminamos eligiendo un modelo de contenido estructurado donde cada artículo tiene campos separados para título, resumen, cuerpo, autor y metadatos SEO, en vez de un solo campo de texto enriquecido como en el sistema anterior.

Marina Ortiz: La cuarta etapa fue la migración de contenido en sí. Escribimos un script que tomaba el HTML viejo, lo limpiaba de marcado obsoleto, y lo mapeaba a los nuevos campos estructurados, validando automáticamente que no se perdiera ningún párrafo en el proceso.

Marina Ortiz: Aquí un punto importante: no migramos todo de golpe. Migramos primero un cinco por ciento del contenido de menor riesgo, medimos durante dos semanas, y solo después seguimos con el resto en tandas.

Marina Ortiz: La quinta etapa fue el rendimiento técnico. El sitio nuevo tenía que cargar más rápido que el viejo, no solo verse mejor. Trabajamos imágenes con formatos modernos, carga diferida, y un sistema de caché en el borde de la red.

Marina Ortiz: El resultado de esa etapa fue pasar de un tiempo de carga promedio de cuatro segundos a menos de un segundo y medio en la mayoría de los artículos, medido con datos reales de usuarios, no solo en laboratorio.

Marina Ortiz: La sexta etapa, y la que más ansiedad generaba, fue el día del cambio de DNS. Preparamos un plan minuto a minuto: quién monitorea el tráfico, quién revisa errores cuatro cero cuatro, y quién tiene autoridad para revertir si algo sale mal.

Marina Ortiz: Documentamos también un criterio claro de "punto de no retorno": si a las dos horas el tráfico no había caído más de un quince por ciento, seguíamos adelante. Si caía más que eso, revertíamos sin discutirlo en el momento.

Marina Ortiz: Ahora, los resultados. En la primera semana el tráfico bajó apenas un tres por ciento, dentro de lo esperado por el ruido normal de cualquier cambio grande de infraestructura.

Marina Ortiz: Para el segundo mes, el tráfico ya había recuperado el nivel anterior a la migración, y para el cuarto mes estaba doce por ciento por encima, gracias a los tiempos de carga más rápidos, que Google premia en el ranking.

Marina Ortiz: Quiero resumir los puntos clave de todo este proceso, porque son los que más nos preguntan cuando contamos esta historia en conferencias.

Marina Ortiz: Punto clave uno: la auditoría de contenido siempre va antes que la elección de tecnología. Elegir la herramienta primero es el error más común y el más caro de corregir después.

Marina Ortiz: Punto clave dos: las redirecciones uno a uno, específicas por URL, no son negociables. Es trabajo tedioso, pero es el que más protege el tráfico existente.

Marina Ortiz: Punto clave tres: migrar en tandas pequeñas y medidas, nunca todo de golpe, permite detectar problemas cuando todavía son baratos de arreglar.

Marina Ortiz: Punto clave cuatro: el rendimiento técnico no es un detalle estético, es una de las señales que más pesa en cómo Google trata tu contenido después de un cambio grande.

Marina Ortiz: Punto clave cinco: un plan de reversión claro, con criterios numéricos definidos de antemano, evita decisiones apuradas y emocionales el día del lanzamiento.

Marina Ortiz: Como conclusión, si están considerando una migración similar, el consejo más importante que puedo darles es que el trabajo invisible —auditoría, redirecciones, plan de reversión— es el que determina si el tráfico sobrevive, mucho más que la tecnología elegida.

Marina Ortiz: Eso es todo por este episodio largo. Gracias por acompañarnos hasta el final, y nos escuchamos en el próximo.`;

const DEMO_TRANSCRIPTS: Record<DemoTranscriptLength, { title: string; text: string }> = {
  short: { title: DEMO_TRANSCRIPT_SHORT_TITLE, text: DEMO_TRANSCRIPT_SHORT_TEXT },
  medium: { title: DEMO_TRANSCRIPT_TITLE, text: DEMO_TRANSCRIPT_TEXT },
  long: { title: DEMO_TRANSCRIPT_LONG_TITLE, text: DEMO_TRANSCRIPT_LONG_TEXT },
};

export function getDemoTranscript(length: DemoTranscriptLength): { title: string; text: string } {
  return DEMO_TRANSCRIPTS[length];
}

const VALID_LENGTHS: DemoTranscriptLength[] = ['short', 'medium', 'long'];

/**
 * Lee `DEMO_TRANSCRIPT_LENGTH` una sola vez y en un solo lugar, para que
 * cualquier código que necesite tanto el texto de la transcripción demo
 * (`DemoTranscriptionProvider`) como su título (p. ej. `transcribeYoutubeAudioAction`
 * en modo demo) usen siempre el mismo criterio de selección sin duplicarlo.
 */
export function getConfiguredDemoTranscriptLength(): DemoTranscriptLength {
  const raw = (process.env.DEMO_TRANSCRIPT_LENGTH ?? 'medium').toLowerCase();
  return VALID_LENGTHS.includes(raw as DemoTranscriptLength) ? (raw as DemoTranscriptLength) : 'medium';
}

export const DEMO_PROJECT_DEFAULTS = {
  name: 'Demo: Plan de contenidos trimestral',
  provisionalTitle: DEMO_TRANSCRIPT_TITLE,
  contentType: 'guide' as const,
  audience: 'Responsables de marketing de contenidos en empresas B2B',
  tone: 'professional' as const,
  language: 'es',
  primaryKeyword: 'plan de contenidos trimestral',
  objective: 'Explicar un proceso replicable para planear contenido por objetivos de negocio',
  callToAction: 'Agenda una asesoría gratuita de estrategia de contenidos',
};
