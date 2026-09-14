export const detailData = {
  aloj1: {
    title: 'Habitación en Cerro Alegre',
    emoji: '🏠',
    badge: { text: 'Disponible', color: 'green' },
    address: '📍 Almirante Montt 256',
    price: '$280.000/mes',
    description:
      'Habitación individual en departamento compartido con 2 compañeros. Baño compartido, cocina equipada, excelente vista al mar. A 15 min caminando de la PUCV.',
    reviews: [
      { autor: 'Sofía R.', pais: 'México', stars: '★★★★★', texto: 'Todo perfecto. La dueña muy simpática y el barrio es tranquilo y seguro.' },
      { autor: 'Lucas B.', pais: 'Brasil', stars: '★★★★☆', texto: 'Buena ubicación, aunque el calefactor es medio antiguo. Vale el precio.' },
    ],
  },
  aloj2: {
    title: 'Departamento compartido — Viña del Mar',
    emoji: '🏢',
    badge: { text: '2 cupos', color: 'amber' },
    address: '📍 Av. Libertad 1050, Viña',
    price: '$195.000/mes',
    description:
      'Piso compartido con 4 habitaciones. Muy cerca del metro y la playa. Gastos comunes incluidos. Ideal para intercambios de la USM o PUCV.',
    reviews: [
      { autor: 'Priya K.', pais: 'India', stars: '★★★★★', texto: 'El mejor precio que encontré en Viña. Los compañeros son buena onda.' },
      { autor: 'Jean P.', pais: 'Francia', stars: '★★★★★', texto: 'Increíble relación calidad-precio. Tiene vista al mar y está impecable.' },
    ],
  },
  com1: {
    title: 'Feria Cardonal',
    emoji: '🛒',
    badge: { text: 'Feria libre', color: 'green' },
    address: '📍 Yungay s/n, Valparaíso',
    price: '🕐 Mar, Jue, Sáb — 8:00 a 14:00',
    description:
      'La feria más grande del centro. Frutas y verduras a precios hasta 60% más baratos que el supermercado. También hay pescado, carnes y artesanías.',
    reviews: [
      { autor: 'María J.', pais: 'España', stars: '★★★★★', texto: 'No puedo creer lo barato que es. Espinaca gigante por $500. Voy cada sábado.' },
      { autor: 'Carlos P.', pais: 'Colombia', stars: '★★★★★', texto: 'Lo mejor para el presupuesto de estudiante. El puesto del señor Ramiro es el mejor.' },
    ],
  },
  zona1: {
    title: 'Cerro Alegre / Cerro Concepción',
    emoji: '🟢',
    badge: { text: 'Zona Segura', color: 'green' },
    address: '🌙 Segura hasta las 23:00',
    price: '',
    description:
      'Barrio turístico con cafeterías, galerías y restaurantes. Muy transitado de día y noche. Buena iluminación y presencia de turistas y locales todo el tiempo.',
    reviews: [
      { autor: 'Hana L.', pais: 'Japón', stars: '★★★★★', texto: 'Me siento completamente segura incluso de noche. Es el barrio más lindo de Valparaíso.' },
      { autor: 'Rania A.', pais: 'Marruecos', stars: '★★★★☆', texto: 'Perfecto para caminar tranquila. Eso sí, los fines de semana es muy turístico.' },
    ],
  },
};

const fallbackNames = {
  aloj3: 'Pieza en casa familiar',
  aloj4: 'Pension Cerro Baron',
  com2: 'Panadería Don Juan',
  com3: 'Farmacia Popular Cruz',
  com4: 'Restaurant El Puerto',
  zona2: 'Puerto / Aduana',
  zona3: 'Av. Argentina / Plaza Victoria',
};

Object.entries(fallbackNames).forEach(([id, title]) => {
  detailData[id] = {
    title,
    emoji: '📍',
    badge: null,
    address: '',
    price: '',
    description: 'Información disponible próximamente.',
    reviews: [],
  };
});
