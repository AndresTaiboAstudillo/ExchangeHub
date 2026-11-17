# Especificación preliminar de la capacidad adaptativa

Documento de diseño para el Módulo 3. No exige implementar el modelo de usuario, el motor de decisión
ni la adaptación final; fija qué se construirá y cómo se evaluará.

## 1. Resumen

**«Mi entorno universitario»**: la plataforma adapta el orden de los alojamientos y las zonas a la
**universidad de destino** del estudiante y a sus **prioridades declaradas** (cercanía, seguridad,
valoración de otros estudiantes). Cada resultado muestra por qué aparece en esa posición.

## 2. Qué parte del sistema se adapta

El **orden y la explicación** de la lista de alojamientos (`listings`) y de zonas (`zones`). No se
ocultan resultados: la adaptación solo reordena y etiqueta, de modo que el estudiante siempre puede
volver al orden neutro (más recientes primero).

## 3. Usuario beneficiado

Estudiante internacional que llega a Chile y todavía no conoce la ciudad. Hoy ve una lista
indiferenciada; necesita saber qué opciones le quedan cerca de su universidad y en qué barrios se
siente más seguro.

## 4. Información recuperada desde la Web que se usa

| Dato | Fuente | Uso en la decisión |
|---|---|---|
| Universidad de destino (nombre, tipo, vigencia) | Catálogo del Ministerio de Educación | Es la lista entre la que el estudiante elige su destino. |
| Coordenadas de la universidad | Wikidata | Calcular la distancia desde cada alojamiento y zona. |
| Sitio web y año de fundación | Wikidata | Contexto mostrado junto al destino (no entra en el puntaje). |

Limitación conocida: las coordenadas de Wikidata cubren solo una parte de las universidades (la
cobertura real se medirá con `scripts/run_pipeline.py`). Para una universidad sin coordenadas no se
puede calcular cercanía; ver el comportamiento alternativo en la sección 8.

## 5. Variables de usuario y de contexto

**Del perfil (declaradas por el estudiante):**
- Universidad de destino. *Requiere un campo nuevo* `destination_university_id` en `users`
  (relación con `universities`). Hoy solo existe `university_origin`, que es la universidad de
  procedencia en el extranjero y no sirve para este fin.
- Prioridades: orden de importancia entre cercanía, seguridad y valoración (por defecto, equilibradas).
- Distancia máxima aceptable (opcional).

**Del contexto (calculadas):**
- Distancia entre el alojamiento o la zona y la universidad de destino.
- Valoración media de la zona según las reseñas de estudiantes (`reviews` con `target_type = 'zone'`) y su horario recomendado (`safe_hours`). El nivel fijo de seguridad se eliminó: ahora lo expresan las reseñas.
- Valoración media y número de reseñas (`reviews`).

No se usan datos sensibles ni se infiere nada del comportamiento en esta primera versión.

## 6. Decisión que toma el sistema

Para cada alojamiento o zona decide **su posición** en la lista y **qué razones mostrar**.

## 7. Resultado visible para el usuario

- Lista ordenada para «mi universidad», con selector para cambiar de destino o volver al orden neutro.
- Etiquetas de explicación en cada tarjeta, por ejemplo «a 1,2 km de tu universidad», «zona bien
  valorada» o «4,5 ★ según 8 estudiantes».
- Aviso cuando falte un dato: «No tenemos la ubicación de tu universidad; mostramos las opciones
  mejor valoradas».

## 8. Mecanismo

**Reglas y puntaje ponderado, sin aprendizaje automático.** Elegido por tres razones: hay pocos
datos para entrenar un modelo, cada decisión debe poder explicarse al estudiante y el comportamiento
es verificable con pruebas.

```
puntaje = w_cercanía · s_cercanía + w_seguridad · s_seguridad + w_valoración · s_valoración
```

- `s_cercanía = 1 / (1 + distancia_km / 2)`, con distancia de Haversine entre coordenadas.
  Los alojamientos más lejos que la distancia máxima declarada se bajan al final, no se eliminan.
- `s_seguridad`: valor fijo por nivel (alta, media, baja) de la zona más cercana al alojamiento.
- `s_valoración`: media de las reseñas suavizada con un valor previo para no sobrevalorar un
  alojamiento con una sola reseña.
- Los pesos `w` salen de las prioridades declaradas; sin declaración, son iguales.

**Comportamientos alternativos (degradación controlada):**

| Situación | Qué hace el sistema |
|---|---|
| Sin universidad de destino elegida | Orden neutro y una invitación a elegirla. |
| Universidad sin coordenadas | Se omite la cercanía, se renormalizan los pesos restantes y se avisa. |
| Alojamiento sin reseñas | Se usa solo cercanía y seguridad; se marca «sin reseñas todavía». |
| Catálogo desactualizado | Se sigue usando el último dato válido y se muestra su antigüedad. |

**Evolución posible**, fuera de esta entrega: usar la búsqueda ya implementada (BM25) para que el
estudiante escriba su necesidad en lenguaje libre, y ajustar los pesos a partir de las elecciones
reales, solo con consentimiento explícito.

## 9. Evaluación posterior de la utilidad

| Pregunta | Método | Métrica |
|---|---|---|
| ¿Ordena como se espera? | Casos de prueba con resultado esperado conocido (universidad con alojamientos a distintas distancias y zonas de distinta seguridad) | Pruebas automatizadas del orden; Precision@K y nDCG@K contra un orden de referencia hecho a mano |
| ¿La explicación es correcta? | Verificar que cada etiqueta coincida con los datos que la originan | Porcentaje de etiquetas correctas (objetivo: 100 %) |
| ¿Se degrada bien? | Probar cada fila de la tabla de comportamientos alternativos | Pruebas automatizadas |
| ¿Es útil para el estudiante? | Prueba con 5 a 10 estudiantes: tarea «encuentra un alojamiento adecuado para tu universidad», adaptado frente a orden neutro | Tiempo hasta elegir, posición del alojamiento elegido, valoración de utilidad de 1 a 5 |
| ¿Cobertura suficiente? | Medir cuántas universidades tienen coordenadas | Porcentaje de universidades con ubicación |

## 10. Riesgos y límites

- Si la cobertura de coordenadas es baja, la adaptación quedará limitada a pocas universidades. Es
  el riesgo principal y se mide antes de construirla.
- Las zonas y los alojamientos los cargan los propios usuarios: hay pocos datos y pueden estar sesgados.
- Los pesos fijos son una simplificación. La versión con aprendizaje queda como línea futura.
- El estudiante debe poder desactivar la adaptación en cualquier momento.

## 11. Trabajo para el Módulo 3

1. Migración: campo `destination_university_id` y preferencias del estudiante.
2. Servicio de puntaje (NestJS) con pruebas unitarias de cada término y de las degradaciones.
3. Endpoint de alojamientos ordenados con la explicación de cada posición.
4. Interfaz: selector de destino, prioridades y etiquetas de explicación.
5. Evaluación según la sección 9.
