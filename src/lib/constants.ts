import type { AppSettings, TemplateTask, UserProfile } from "./types";

export const STORAGE_KEY = "house-os-v1";

export const DEFAULT_USERS: Record<string, UserProfile> = {
  fabian: {
    id: "fabian",
    name: "Fabián",
    colorLabel: "#5d7554"
  },
  mauri: {
    id: "mauri",
    name: "Mauri",
    colorLabel: "#a65f3b"
  }
};

export const CATEGORY_OPTIONS = [
  "Synaptix",
  "Tienda de ropa",
  "Barbuto",
  "Dropshipping",
  "Psicología",
  "Estudio",
  "Entrenamiento",
  "Limpieza casa",
  "Patio",
  "Descanso",
  "Reunión",
  "Medicamento",
  "Cocina/comida",
  "Cierre del día",
  "Inicio del día",
  "Preparación",
  "Ventas",
  "Casa",
  "Cierre comercial",
  "Sueño"
];

export const PRODUCTIVITY_RULES = [
  "Caja primero.",
  "Todos los días tiene que quedar algo vendido, ofrecido, probado o mejorado.",
  "No se castiga el fallo, se registra y se vuelve al sistema.",
  "La mañana no se improvisa.",
  "Barbuto se valida vendiendo, no pensando perfecto.",
  "La casa sostiene el sistema.",
  "El entrenamiento mantiene el cuerpo disponible para trabajar."
];

export const PERSONAL_PRIORITIES = {
  fabian: [
    "Synaptix",
    "Barbuto",
    "Tienda de ropa",
    "Entrenamiento",
    "Estudio",
    "Casa"
  ],
  mauri: [
    "Dropshipping",
    "Barbuto",
    "Entrenamiento",
    "Psicología",
    "Patio/casa",
    "Otro ingreso"
  ]
};

export const WEEKLY_GOALS = {
  fabian:
    "Si esta semana sale bien, el sábado deberíamos haber conseguido clientes/ventas y haber entrenado al menos 5 veces en la semana.",
  mauri: "Si esta semana sale bien, el sábado deberíamos haber comenzado las ventas."
};

export const FINANCIAL_CONTEXT =
  "Situación ajustada: priorizar tareas que generan caja o acercan a ventas: Synaptix, Barbuto, tienda de ropa y dropshipping.";

export const BASE_TEMPLATE: TemplateTask[] = [
  {
    id: "0630-fabian-start",
    title: "Levantarse, baño, agua/mate, abrir la casa",
    description: "Inicio operativo de la casa.",
    user: "fabian",
    category: "Inicio del día",
    startTime: "06:30",
    endTime: "06:55",
    priority: "medium",
    recurring: true
  },
  {
    id: "0630-mauri-start",
    title: "Dormir o despertar progresivo",
    description: "Despertar suave sin forzar el arranque.",
    user: "mauri",
    category: "Inicio del día",
    startTime: "06:30",
    endTime: "06:55",
    priority: "low",
    recurring: true
  },
  {
    id: "0655-samexid",
    title: "Tomar Samexid 30 mg",
    description: "Fabián recuerda el medicamento. Mauri toma Samexid 30 mg.",
    user: "mauri",
    category: "Medicamento",
    startTime: "06:55",
    endTime: "07:10",
    note: "Recordatorio personal. Seguir indicación médica.",
    priority: "high",
    recurring: true,
    reminder: true
  },
  {
    id: "0710-breakfast-meeting",
    title: "Desayuno y reunión corta de mañana",
    description: "Definir las 3 tareas principales del día.",
    user: "both",
    category: "Reunión",
    startTime: "07:10",
    endTime: "07:35",
    priority: "high",
    recurring: true
  },
  {
    id: "0735-fabian-house",
    title: "Orden rápido de casa/cocina",
    description: "Preparar el entorno para trabajar sin fricción.",
    user: "fabian",
    category: "Preparación",
    startTime: "07:35",
    endTime: "08:00",
    priority: "medium",
    recurring: true
  },
  {
    id: "0735-mauri-activation",
    title: "Activación suave, agua, luz solar, revisar patio",
    description: "Entrada progresiva al día y chequeo rápido del patio.",
    user: "mauri",
    category: "Preparación",
    startTime: "07:35",
    endTime: "08:00",
    priority: "medium",
    recurring: true
  },
  {
    id: "0800-fabian-synaptix",
    title: "Synaptix",
    description: "Bloque de trabajo/foco para generar avance comercial.",
    user: "fabian",
    category: "Synaptix",
    startTime: "08:00",
    endTime: "10:00",
    priority: "high",
    recurring: true
  },
  {
    id: "0800-mauri-dropshipping",
    title: "Estudio de dropshipping - bloque mañana",
    description: "Bloque de estudio aplicado a ventas online.",
    user: "mauri",
    category: "Dropshipping",
    startTime: "08:00",
    endTime: "10:00",
    priority: "high",
    recurring: true
  },
  {
    id: "1000-short-break",
    title: "Descanso corto",
    description: "Pausa breve antes del segundo bloque fuerte.",
    user: "both",
    category: "Descanso",
    startTime: "10:00",
    endTime: "10:15",
    priority: "low",
    recurring: true
  },
  {
    id: "1015-fabian-clothes",
    title: "Tienda de ropa - ventas, publicaciones, proveedores, mensajes",
    description: "Trabajo comercial directo.",
    user: "fabian",
    category: "Tienda de ropa",
    startTime: "10:15",
    endTime: "12:15",
    priority: "high",
    recurring: true
  },
  {
    id: "1015-mauri-patio",
    title: "Patio 1 h si hay clima/luz",
    description: "Mantener patio y revisar tareas físicas de la casa.",
    user: "mauri",
    category: "Patio",
    startTime: "10:15",
    endTime: "11:15",
    priority: "high",
    recurring: true
  },
  {
    id: "1115-mauri-dropshipping-applied",
    title: "Dropshipping aplicado 1 h",
    description: "Convertir estudio en acción comercial concreta.",
    user: "mauri",
    category: "Dropshipping",
    startTime: "11:15",
    endTime: "12:15",
    priority: "high",
    recurring: true
  },
  {
    id: "1215-barbuto-planning",
    title: "Barbuto - preventa, costos, compras, menú, publicaciones",
    description: "Planificación orientada a venta real.",
    user: "both",
    category: "Barbuto",
    startTime: "12:15",
    endTime: "13:00",
    priority: "high",
    recurring: true
  },
  {
    id: "1300-lunch-rest",
    title: "Almuerzo y descanso",
    description: "Descanso principal del día.",
    user: "both",
    category: "Descanso",
    startTime: "13:00",
    endTime: "15:00",
    priority: "medium",
    recurring: true
  },
  {
    id: "1500-fabian-cleaning",
    title: "Limpieza de casa",
    description: "La casa sostiene el sistema.",
    user: "fabian",
    category: "Limpieza casa",
    startTime: "15:00",
    endTime: "16:00",
    priority: "medium",
    recurring: true
  },
  {
    id: "1500-mauri-dropshipping",
    title: "Dropshipping tarde - bloque 1",
    description: "Bloque aplicado de tarde.",
    user: "mauri",
    category: "Dropshipping",
    startTime: "15:00",
    endTime: "16:00",
    priority: "high",
    recurring: true
  },
  {
    id: "1600-fabian-study",
    title: "Estudio personal - neuropsicología, lectura o tema de interés",
    description: "Estudio personal de Fabián.",
    user: "fabian",
    category: "Estudio",
    startTime: "16:00",
    endTime: "17:00",
    priority: "medium",
    recurring: true
  },
  {
    id: "1600-mauri-dropshipping",
    title: "Dropshipping tarde - bloque 2",
    description: "Segundo bloque aplicado de tarde.",
    user: "mauri",
    category: "Dropshipping",
    startTime: "16:00",
    endTime: "17:00",
    priority: "high",
    recurring: true
  },
  {
    id: "1700-training",
    title: "Entrenamiento juntos",
    description: "Fuerza, movilidad, sombra/técnica o calistenia.",
    user: "both",
    category: "Entrenamiento",
    startTime: "17:00",
    endTime: "18:00",
    priority: "high",
    recurring: true
  },
  {
    id: "1800-fabian-study",
    title: "Estudio personal",
    description: "Segundo bloque de estudio personal.",
    user: "fabian",
    category: "Estudio",
    startTime: "18:00",
    endTime: "19:00",
    priority: "medium",
    recurring: true
  },
  {
    id: "1800-mauri-psychology",
    title: "Psicología - bloque 1",
    description: "Bloque de estudio o práctica de psicología.",
    user: "mauri",
    category: "Psicología",
    startTime: "18:00",
    endTime: "19:00",
    priority: "medium",
    recurring: true
  },
  {
    id: "1900-fabian-followup",
    title: "Follow-up Synaptix / tienda de ropa / mensajes",
    description: "Cierre comercial y mensajes pendientes.",
    user: "fabian",
    category: "Cierre comercial",
    startTime: "19:00",
    endTime: "20:00",
    priority: "high",
    recurring: true
  },
  {
    id: "1900-mauri-psychology",
    title: "Psicología - bloque 2",
    description: "Segundo bloque de psicología.",
    user: "mauri",
    category: "Psicología",
    startTime: "19:00",
    endTime: "20:00",
    priority: "medium",
    recurring: true
  },
  {
    id: "2000-barbuto-kitchen-sales",
    title: "Barbuto - cocinar, vender, pedidos, fotos y contenido",
    description: "Cocinar, vender, responder pedidos, sacar fotos, grabar contenido, entregar o preparar pedidos.",
    user: "both",
    category: "Barbuto",
    startTime: "20:00",
    endTime: "22:00",
    priority: "high",
    recurring: true
  },
  {
    id: "2200-close-day",
    title: "Cierre de casa/cocina + reunión de noche",
    description:
      "Preguntas: ¿Qué se hizo? ¿Qué no se hizo? ¿Qué generó dinero o posibilidad real de dinero? ¿Qué se mueve para mañana? ¿Qué fue humo?",
    user: "both",
    category: "Cierre del día",
    startTime: "22:00",
    endTime: "22:30",
    priority: "high",
    recurring: true
  },
  {
    id: "2230-wind-down",
    title: "Bajar revoluciones, higiene, preparar sueño",
    description: "Cierre físico y mental.",
    user: "both",
    category: "Descanso",
    startTime: "22:30",
    endTime: "23:30",
    priority: "medium",
    recurring: true
  },
  {
    id: "2330-sleep",
    title: "Dormir ideal",
    description: "Hora ideal de sueño.",
    user: "both",
    category: "Sueño",
    startTime: "23:30",
    endTime: "23:59",
    priority: "high",
    recurring: true
  }
];

export const DEFAULT_SETTINGS: AppSettings = {
  users: DEFAULT_USERS,
  includeSundays: false,
  theme: "dark",
  baseTemplate: BASE_TEMPLATE
};
