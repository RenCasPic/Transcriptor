/**
 * Transcripción de demostración. Permite explorar la generación de artículos
 * sin depender de una API de transcripción externa (modo demo, requisito 4.4/12).
 */
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
