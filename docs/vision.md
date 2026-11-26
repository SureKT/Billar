# Visión por ordenador — anotar turnos solos

Traspaso desde la sesión `vibo` (26-11-2026). Nada construido todavía: esto es la idea, el
alcance y el plan de la primera prueba, para arrancar en la sesión `billar` sin perder
contexto.

## Por qué

Dejamos de usar la app porque **da pereza anotar cada turno**: qué bolas entran, cuándo hay
falta. El problema no es la app, es meter datos a mano. Si una cámara detecta lo que pasa en
la mesa, la app vuelve a ser cómoda de usar.

También es el proyecto con más aprendizaje real: la visión por ordenador sobre una mesa, una
luz y una cámara concretas no se resuelve escribiendo código a ciegas; hay que entender qué
pasa para ajustar y depurar con vídeo real.

## Por qué es abordable

- La mesa es un **plano en 2D** visto desde arriba, con bolas de colores conocidos.
- Los **turnos se separan solos**: entre tiro y tiro todas las bolas están quietas. Movimiento
  → quietud marca el final de un tiro.
- Una bola metida **desaparece cerca de una tronera**. La blanca metida es falta y también
  se detecta así.

## Alcance

**Sí (v1):**
- Detectar las bolas sobre la mesa y su número/color.
- Detectar el final de cada tiro (todas quietas tras haberse movido).
- Comparar antes y después: qué bolas han entrado. Blanca metida → falta.
- Proponer el turno a la app; el jugador lo confirma o corrige.

**No (de momento):**
- Faltas que dependen del contacto (qué bola tocó primero la blanca, no tocar banda…):
  se siguen marcando a mano. Son mucho más difíciles.
- Tiempo real en la primera prueba: se trabaja sobre vídeos grabados.

**Encaje con la app:** el modelo `Turno` ya guarda `bolas_metidas_json` y `faltas_ids_json`,
y hay `POST /partidas/{id}/turnos`. La visión solo tiene que producir "bolas metidas en este
tiro" y la app sigue aplicando sus reglas (`logic.evaluar_turno`). Verificar este encaje
antes de integrar.

## Montaje

- Mesa **Valley de 7 pies**, tapete **rosa**. El rosa tiene matiz rojizo: ojo con distinguir
  la bola 3 (roja) y la 7 (granate) del fondo; probablemente haya que segmentar por algo más
  que el color.
- Grabación con el **móvil desde arriba**, fijo en un soporte, viendo la mesa entera.
- La luz importa: reflejos en las bolas y sombras del jugador son el ruido principal.

## Plan de la primera prueba (uno o dos fines de semana)

1. Grabar varias partidas desde arriba con el móvil, sin integración de ningún tipo.
2. Sobre esos vídeos:
   - corregir la perspectiva para ver la mesa como un rectángulo;
   - detectar las bolas en un fotograma;
   - detectar los momentos en que todo está quieto;
   - comparar dos momentos quietos y sacar qué bolas faltan.
3. Decidir con datos: si funciona razonablemente y engancha, se sigue y se integra con la
   app; si no, se descarta habiendo aprendido.

Código en una carpeta `vision/` dentro de este repo, con sus propias dependencias (OpenCV
y similares no deben entrar en la imagen de la app). **Los vídeos fuera de git** (pesan):
por ejemplo `/srv/billar/videos`.

## Cómo quiere trabajar Gerard en este proyecto

- Quiere **entender qué ocurre y por qué** en cada paso: qué técnica se usa, qué
  alternativas hay, por qué falla algo. Explicar antes de implementar.
- **No quiere escribir el código él**: Claude implementa, pero en pasos pequeños y
  explicados, para que Gerard decida y aprenda cómo funciona la visión por dentro.
- La app de billar se usa en casa con amigos; el resultado debería poder publicarse y
  servir de portfolio (un vídeo de la mesa con el marcador actualizándose solo).
