# Juego del Tren (Starter)

Estructura:
- index.html
- script.js
- /css/train.css
- /css/ui.css
- /jsons/preguntas.json
- /jsons/escenario_01..05.json
- /jsons/escenario_final.json
- /assets/img/ (agrega: locomotive.png, wagon.png)
- /assets/tiles/ (agrega tus tiles .png si quieres; el juego dibuja placeholders si faltan)

Notas:
- El tren se mueve de centro de tile a centro de tile. El sprite rota suavemente hacia el vector de movimiento.
- Hay locomotora + vagones. Ganas +1 vagón por cada respuesta correcta. Los vagones van separados por 1 tile.
- Al llegar la locomotora a la última tile de la escena final, todos se detienen de inmediato (no se enciman).
- Puedes cambiar A/B durante la fase de pregunta; al llegar a la última tile de pregunta se bloquea la elección y el tren recorre la respuesta.
- Variables expuestas en script.js (puntos, penalización, errores máximos, velocidad, etc.). Overrides por URL (p. ej. ?speed=200&maxErrors=3&penalty=10).
- preguntas.json: he normalizado el CSV a UTF-8. La #14 y #15 traían inconsistencias (posibles etiquetas/campos faltantes). Las dejé literal con una nota en la 15.
- Si no colocas imágenes en /assets, verás placeholders dibujados en canvas (sirven para desarrollo).

¡Suerte! 