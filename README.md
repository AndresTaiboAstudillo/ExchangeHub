# Readme para Ingeniería Web Avanzada
# ExchangeHub
# Aplicación web y móvil para estudiantes extranjeros que vengan a Chile de intercambio.
# Andrés Taibo
# El proyecto busca reducir la frustración de los estudiantes extranjeros al entregarles una herramienta centralizada que los ayudará a encontrar alojamiento, comercio y a otras personas en una situación similar.
# Los usuarios objetivo son estudiantes de intercambio.
# Objetivo general: Desarrollar una plataforma digital integral que mejore la experiencia de movilidad estudiantil internacional en Chile, promoviendo la inclusión, la seguridad y la colaboración entre instituciones académicas y estudiantes internacionales.
# Objetivos específicos:
* Analizar los requerimientos funcionales y no funcionales de los estudiantes internacionales en Chile, con el fin de determinar las necesidades críticas en términos de vivienda, trámites administrativos e integración social.
* Identificar las fuentes de datos y servicios de terceros (API de OpenStreetMap) que permitan la extracción de información confiable sobre geolocalización y listados de alojamiento verificado.
* Diseñar la arquitectura del sistema y la interfaz de usuario (UX/UI), definiendo la estructura de la base de datos en PostgreSQL y el flujo de navegación para asegurar una experiencia intuitiva y centralizada.
* Desarrollar la plataforma web full-stack utilizando el stack Next.js, Node.js y Express, integrando los módulos de comunicación en tiempo real, mapas interactivos y el repositorio de guías informativas.
* Validar la eficiencia y usabilidad de la solución propuesta mediante pruebas con usuarios reales y la aplicación de la métrica System Usability Scale (SUS), para asegurar que la plataforma cumple con los estándares de calidad esperados.
 # alcance y exclusiones: La aplicación se basa en opiniones de estudiantes de intercambio, no se incluyen transacciones ni emparejamiento con arrendadores o comercios.
 # principales funcionalidades
 * Mapa de comercio, zonas de interés y arriendos con reviews de estudiantes.
 * Foro general para discusiones relacionadas con el ámbito académico
 * Chat en tiempo real
 * Perfil personal y amistades
 * Buscador de amigos
 # arquitectura general
 # tecnologias y herramientas utilizadas
 * Nodejs, postgres, express
 * Socket io
 * OpenStreetMap, Smtp
 # fuente o fuentes de info web
* P. Arias, I. Figueroa, C. Iturrieta, y J. Pérez, “Apuntes 73: Análisis del estudiantado extranjero en el sistema escolar, 2024,” Centro de Estudios MINEDUC (CEM), Ministerio de Educación, Chile, ene. 2025. [En línea]. Disponible: https://hdl.handle.net/20.500.12365/21440. [Accedido: 08-abr-2026]
* “El comparador de alojamiento para estudiantes | Erasmus Play,” Erasmus Play, 2026. [En línea]. Disponible: https://erasmusplay.com/es/. [Accedido: 08-abr-2026].
* “Cómo encontrar alojamiento como estudiante internacional - Lumos,” Lumos, 2026. [En línea]. Disponible: https://lumoslatam.com/como-encontrar-alojamiento-como-estudiante-internacional/. [Accedido: 08-abr-2026].
* helpHousing, “Alojamiento para jóvenes internacionales,” 2026. [En línea]. Disponible: https://www.helphousing.com/es. [Accedido: 08-abr-2026].
* Universidad de Chile, “Universidad de Chile recibe a 250 estudiantes internacionales de pregrado este semestre,” 10-abr-2026. [En línea]. Disponible: https://uchile.cl/noticias/237667/u-de-chile-recibe-a-250-estudiantes-internacionales-de-pregrado. [Accedido: 10-abr-2026].
* Universidad Católica de Chile, “Ven a la UC,” Dirección de Internacionalización, 2026. [En línea]. Disponible: https://internacionalizacion.uc.cl/ven-a-la-uc/. [Accedido: 10-abr-2026].
* Universidad de La Frontera, “Programa de acogida,” 2026. [En línea]. Disponible: https://internacionalizacion.ufro.cl/movilidad-estudiantil/estudia-en-la-ufro/programa-de-acogida/. [Accedido: 11-abr-2026].
* Duoc UC, “Duocanos crean aplicación móvil para estudiantes de intercambio,” 11-abr-2026. [En línea]. Disponible: https://www.duoc.cl/?noticia_post_type=duocanos-crean-aplicacion-movil-para-estudiantes-de-intercambio. [Accedido: 11-abr-2026].
* Universidad de Santiago de Chile, “Lanzan App que entrega información sobre el intercambio internacional para las y los estudiantes,” 12-abr-2026. [En línea]. Disponible: https://www.usach.cl/news/lanzan-app-entrega-informacion-sobre-intercambio-internacional-para-las-y-los-estudiantes. [Accedido: 12-abr-2026].
* Geoportal de Chile, “Geoportal de Chile,” 2026. [En línea]. Disponible: https://geoportal.cl. [Accedido: 12-abr-2026].
* Inesdi Business Techschool, “Sistemas de Información Geográfica (SIG): qué son, usos y ejemplos,” 12-abr-2026. [En línea]. Disponible: https://www.inesdi.com/blog/sistemas-de-informacion-geografica-SIG/. [Accedido: 12-abr-2026].
* S. Micheletti Dellamaria, F. Saravia Cortés, y J. Muñoz Tique, “Movilidad estudiantil internacional y efectos en el ámbito personal, académico y laboral: el caso de la Universidad del Bío-Bío en Chile,” Rev. Educ. Las Américas, vol. 12, no. 1, 2022. [En línea]. Disponible: https://portal.amelica.org/ameli/journal/248/2483735001/. [Accedido: 12-abr-2026].
* T. Anderson y H. Kanuka, “On-Line Forums: New Platforms for Professional Development and Group Collaboration,” J. Comput.-Mediat. Commun., vol. 3, no. 3, dic. 1997. DOI: 10.1111/j.1083-6101.1997.tb00078.x.
* J. Owyang, C. Tran, y C. Silva, “The collaborative economy,” Altimeter Group, EE. UU., Informe, 2013.
* D. J. Maguire, “An overview and definition of GIS,” en Geographical Information Systems: Principles and Applications, vol. 1, no. 1, pp. 9-20
* Google Cloud, "¿Qué es una API REST?," Google Cloud. [En línea]. Disponible: https://cloud.google.com/discover/what-is-rest-api?hl=es. [Accedido: 9-sep-2026]. 
* Microsoft, "WebSockets," Microsoft Learn, 30-ago-2026. [En línea]. Disponible: https://learn.microsoft.com/es-es/windows/apps/develop/networking/websockets. [Accedido: 9-sep-2026]. 
* Amazon Web Services, "¿Cuál es la diferencia entre el front end y back end en el desarrollo de aplicaciones?," AWS. [En línea]. Disponible: https://aws.amazon.com/es/compare/the-difference-between-frontend-and-backend/. [Accedido: 9-sep-2026].  
* I. Sommerville, Ingeniería de software, 9.ª ed. Naucalpan de Juárez, México: Pearson Educación, 2011. 
* J. Brooke, "SUS: A quick and dirty usability scale," in Usability Evaluation in Industry, P. W. Jordan, B. Thomas, B. A. Weerdmeester, and I. L. McClelland, Eds. London, UK: Taylor & Francis, 1996, pp. 189-194.
* K. Schwaber and J. Sutherland, The Scrum Guide: The Definitive Guide to Scrum: The Rules of the Game. Scrum.org and ScrumGuides.org, Nov. 2020. [En línea]. Available: https://scrumguides.org/docs/scrumguide/v2020/2020-Scrum-Guide-US.pdf.[Accedido: 12-abr-2026]

 # El sistema generará recomendaciones de amistades dependiendo de los intereses del usuario
 # instrucciones de instalacion
 * git clone https://github.com/AndresTaiboAstudillo/ExchangeHub
 * cd ExchangeHub
 * cd frontend
 * npm install
 # configuracion de variables de entorno
 # instrucciones de ejecucion
 # instrucciones de uso
 # ejecucion de pruebas
 # proceso de construccion con docker
 # proceso de despliegue
 # enlace al ambiente de staging
 # documentacion de la API
 # imagenes y diagramas
 # enlace a prototipo figma
 # limitaciones conocidas
 # trabajo futuro
