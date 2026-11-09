# Cambios

## 1.2.0 · 2026-11-09
- **Modo oscuro rehecho:** los colores del sistema pasan a variables (fondo, línea, texto sobre color), así que fichas de personaje y de PNJ, panel, diarios, chuleta, tablas, código, tarjetas de chat y diálogos se leen bien en oscuro; el índice del diario resalta su selección con texto oscuro.
- **Los retos ya no se cierran solos:** el panel repintaba toda la ventana cada pocos segundos mientras corría el reloj y plegaba lo que se estaba leyendo. Ahora el reloj se actualiza sin repintar, y las secciones plegables recuerdan si estaban abiertas aunque la ventana se repinte por otro motivo.
- **El talento en combate siempre ayuda:** los personajes suman +1d6 automático por su Talento (Marcial o de Bestia) en cada tirada de ¡PELEA!; ya no hay casilla que marcar. Quien dirige decide el de los PNJ.
- **Ataques especiales de los PNJ:** cada PNJ puede tener varios, editables en su ficha (nombre, frase, coste de Furia, daño extra, recarga, área). En el mando de quien dirige son botones que **dicen su frase solos** (tarjeta de chat y cartel en pantalla). Los jefes los tienen baratos o gratis para **atacar antes que los demás**: Hidetoshi (Chorro Cristalino, Salto de Trampolín, Torrente Olímpico de área, Estilo Libre Desatado), Mariko y la Pandilla. El Torrente del jefe pasa a ser un ataque de área genérico con QTE.
- **Técnica Secreta sugerida:** cada personaje tiene su técnica en la ficha, y el mando se la sugiere en la línea del nombre del golpe y la rellena al pulsar Técnica Secreta.
- **Mensajes sin pisarse:** onomatopeyas y carteles de la pelea comparten una cola única y salen de uno en uno.
- **Configurador de escenas (MR- Dirección):** el paquete `content/direccion-es.json` entrega al módulo el reparto de las 17 escenas, el horizonte, los puntos de apoyo del suelo y 8 efectos de sonido; el Panel tiene una pestaña **Escenas** (ver, configurar, colocar el reparto, tamaño de las figuras), hay botón en Configuración y en la barra de herramientas. Si el módulo no está activo, se explica cómo instalarlo (el sistema lo recomienda).
- Pruebas: 37 (con arnés visual del modo oscuro y del marcador de la pelea).

## 1.1.2 · 2026-11-09
- **Corregido:** el cronómetro de 6 Cruces también corría contra el Jefe Final y, al agotarse, la máquina daba **¡TIEMPO!** y proclamaba ganador al equipo con más porcentaje de Dignidad, sin que nadie hubiera caído. Ahora **un jefe no tiene cronómetro** (marca «∞» en el marcador): su pelea acaba por K.O. o por la cuenta atrás del Vapor. Las peleas normales mantienen su límite de 6 Cruces.

## 1.1.1 · 2026-11-09
- **Sonido nuevo:** los efectos sintetizados (pitidos) se sustituyen por **muestras reales CC0** con aire de dibujos animados: chapuzón con splash, boing y plop; golpes con resortes; gong y «¡ding-dong!» en las cortinillas; toc de madera en los Carteles; campanitas en los éxitos, «¡uah!» en los fiascos; K.O. con golpe, boing de salir volando y el «kiiin» de la estrellita; ¡PERFECTO! con arpegio de campanas, alarma del QTE y vapor de agua caliente. El sintetizador queda como reserva si no cargan. Créditos en `assets/sfx/CREDITOS.md`.

## 1.1.0 · 2026-11-09
- **¡PAM! 2.0 — Pifia Cómica:** los dobles se buscan en **todos** los dados tirados (también los descartados). Dobles altos (4-5-6) = **Caos de Nerima**, un gag a favor del jugador; dobles bajos (1-2-3) = **Pifia Cómica**, un desastre o ¡CHAPUZÓN! aunque la acción saliera bien. Si hay de los dos, manda el Caos; con el dado de Talento, los dobles de 3 son Caos. Con ayuda complicada, la Pifia la paga el ayudante. La tarjeta de tirada lo explica y ofrece el ¡CHAPUZÓN! a quien corresponde.
- **¡PELEA!:** *Parada contra Parada* ya no tira ni resta Dignidad: chocan las espaldas y cada uno gana +1 de Furia. **Furia defensiva:** con 3 puntos, *Evasión Ridícula Absoluta* (anula cualquier ataque, hasta una Técnica) o *peinarse* (+4 de Dignidad, cuenta como Parada sin contraataque). Las Pifias y el Caos también se juegan dentro de los Cruces.
- **Vapor 6:** ya no activa el Final C al instante. El edificio tiembla y hay una **cuenta atrás de 2 Cruces** para vencer al jefe o cerrar una válvula (botón *Válvula cerrada* en el panel); si no, explota. Aviso en la cartela, el panel y el marcador de la pelea.
- **Jefe Final (Capitán Hidetoshi) en un solo round:** una barra de 16 en dos fases. Fase 1 (16–9): cañón de agua con +1d6 y **salpicadura** (si gana un Cruce, el banquillo pierde 1 y no descansa). Fase 2 (8–0): el cañón se rompe y entra con 3 de Furia. **Aislamiento** por ¡CHAPUZÓN! (el personaje estampado no puede ser relevado ese Cruce) y **Torrente Olímpico** de área con **QTE**: los del banquillo ven un botón ¡ESQUIVAR! que tiembla con un temporizador de 4 segundos; quien no reacciona pierde 2 de Dignidad y, si está Seco, se moja.
- **Interfaz de la pelea:** los del banquillo ven sus botones de combate **en gris** y un botón de **Pedir relevo** (se anula pulsándolo otra vez); el luchador activo ve quién lo pide y **elige a quién da entrada**. **Los mandos de los enemigos solo los ve y maneja quien dirige** (también se rechazan en el servidor las peticiones de un jugador sobre un PNJ).
- Manual y PDF actualizados (capítulos 2, 3, 4, 11 y 12); 18 pruebas de reglas y 12 del motor de la pelea con un Foundry de pega.
- Arreglo: la miniatura doble del retrato de la hoja había perdido su marco (regla CSS rota).

## 1.0.0 · 2026-11-08
- Primera versión: mini sistema y aventura de inicio «¡Agua Va!» (Especial Nerima) para Foundry VTT 13–14, en castellano.
- **¡PAM! 2.0:** 2d6 a 4d6, suman los dos mejores; talento de la forma, ayuda complicada y bono de huida estando Mojado; dobles de éxito = gag del Caos de Nerima.
- **Doble forma Seco / Mojado:** interruptor en la ficha con cambio de retrato y figura (también en los tokens ya colocados), ¡CHAPUZÓN! con tarjeta y efecto en pantalla, Regla del Hervidor con el **Termo Portátil** (3 cargas) y **Carteles de Madera** de cuatro palabras que el **Vapor Nocturno** va recortando.
- **¡PELEA!** (novedad): combate de barrio con marcadores de máquina recreativa de lucha — nombres, retratos, barras de Dignidad, Furia, cronómetro y rondas arriba de la pantalla; mando para cada jugador (Golpe > Presa > Parada, Provocar, Entorno, Técnica Secreta a gritos, asistencia y relevo en equipos *tag*); banners «RONDA 1 · ¡PELEA! · ¡K.O.! · ¡PERFECTO! · ¡TIEMPO!»; sonidos sintetizados.
- **Panel de dirección:** reloj real de 120 minutos con avisos de cortinilla, Desbarajuste Acuático, Vapor, Termo, tablillas, 18 retos flotantes, máquina de ¡PELEA! con contendientes preparados, la noche en la Casa de Baños (tuberías cruzadas, tres vías, finales) y reparto con cameos de tres pasos.
- **Aventura completa** que se instala sola en un mundo vacío: 17 escenas (cuatro cortinillas del Guía de Jusenkyo), 4 personajes malditos con sus dos formas, rivales y vecinos, y los diarios de la aventura, la chuleta y las reglas.
- **PDF** de la aventura (B5) con aspecto de especial de revista de anime de 1990, pantalla de *versus* y capítulo de ¡PELEA! en papel de recreativa.
- Accesibilidad, seguridad en mesa, memoria de ventanas, lupa, diagnóstico y créditos.
