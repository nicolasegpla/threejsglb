import { useRef, useEffect, useState } from 'react'; // Importamos hooks de React
import * as THREE from 'three'; // Importamos todo Three.js
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'; // Importamos el cargador de modelos GLTF
import anillos from '../../assets/mono_15m.glb'; // Importamos el modelo GLTF
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'; // Importamos el composer para efectos de postprocesado
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass'; // Importamos el render pass
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass'; // Importamos el Bloom Pass para efectos de iluminación

// Definimos el componente de React Animacion
function Animacion() {
  const mountRef = useRef(); // Referencia al contenedor del canvas
  const composerRef = useRef(); // Referencia al compositor de postprocesado
  const spheresRef = useRef([]); // Referencia a las esferas (elementos del modelo)
  
  const [analyser, setAnalyser] = useState(null); // Estado para el analizador de audio
  const [audioDataArray, setAudioDataArray] = useState(null); // Estado para los datos de audio

  useEffect(() => {
    const w = window.innerWidth; // Ancho de la ventana
    const h = window.innerHeight; // Altura de la ventana

    // Configuración de la escena y la cámara
    const scene = new THREE.Scene(); // Crea una nueva escena
    const camera = new THREE.PerspectiveCamera(75, w / h, 0.01, 1000); // Configura una cámara en perspectiva

    // Configuración del renderer con antialias y transparencia
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio); // Ajusta el pixel ratio
    renderer.setClearColor(0x000000, 0); // Establece el fondo como transparente
    renderer.setSize(w, h); // Ajusta el tamaño del renderer
    mountRef.current.appendChild(renderer.domElement); // Inserta el canvas en el DOM

    // Configuración de la iluminación
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Luz ambiental
    scene.add(ambientLight); // Añade la luz a la escena

    const pointLight = new THREE.PointLight(0xffffff, 1); // Luz puntual más intensa
    pointLight.position.set(5, 5, 5); // Posición de la luz
    scene.add(pointLight); // Añade la luz a la escena

    // Configuración del composer para postprocesado
    const composer = new EffectComposer(renderer); // Crea el EffectComposer para el renderer
    composer.addPass(new RenderPass(scene, camera)); // Añade el RenderPass para renderizar la escena
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.8, 0.1, 0.85); // Configuración del BloomPass con más intensidad y umbral bajo
    composer.addPass(bloomPass); // Añade el BloomPass al composer
    composerRef.current = composer; // Guarda el composer en la referencia

    const colors = [0x008CFF, 0x008CFF, 0xD2EBFF, 0x008CFF, 0x008CFF]; // Colores para los objetos

    // Cargador de modelos GLTF
    const loader = new GLTFLoader(); // Crea el cargador GLTF
    let mixer; // Variable para mezclar animaciones
    let animationFrameId; // ID de la animación para cancelarla más adelante

    // Cargar el modelo GLTF
    loader.load(
      anillos, // Ruta del modelo GLTF
      (gltf) => {
        const model = gltf.scene; // Obtiene el modelo

        let anillos = 0; // Contador de objetos
        model.traverse((child) => {
          if (child.isMesh) {
            const material = child.material; // Obtiene el material del mesh

            // Verifica si el mesh tiene una textura aplicada
            if (material.map) {
              material.map.minFilter = THREE.LinearMipMapLinearFilter; // Filtro para mejorar la calidad de texturas lejanas
              material.map.magFilter = THREE.LinearFilter; // Filtro para mejorar la calidad de texturas ampliadas
              material.map.anisotropy = renderer.capabilities.getMaxAnisotropy(); // Maximiza la anisotropía para mejorar la calidad
              material.map.needsUpdate = true; // Actualiza el material
            }

            // Configuración del material para las esferas
            child.material = new THREE.MeshStandardMaterial({
              color: colors[anillos % colors.length], // Color basado en la lista de colores
              emissive: colors[anillos % colors.length], // Color emisivo
              emissiveIntensity: 2.5, // Ajusta la intensidad emisiva
              roughness: 0.3, // Menos rugosidad para hacer la superficie más lisa
              metalness: 0.9, // Mayor metalicidad para reflejar mejor
            });
            child.originalScale = child.scale.clone(); // Guarda la escala original
            spheresRef.current.push(child); // Añade la esfera a la referencia
            anillos++; // Incrementa el contador
          }
        });

        model.rotation.x = Math.PI / 2; // Rota el modelo
        model.rotation.y = Math.PI / 2; // Rota el modelo
        scene.add(model); // Añade el modelo a la escena

        camera.position.z = 6; // Posiciona la cámara más lejos para mejorar la perspectiva

        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model); // Configura el mixer de animaciones
          gltf.animations.forEach((clip) => {
            const action = mixer.clipAction(clip); // Obtiene la acción de la animación
            action.play(); // Reproduce la animación
          });
        }
      },
      undefined, // Callback para progreso (opcional)
      (error) => {
        console.error('Error al cargar el modelo:', error); // Manejo de errores
      }
    );

    // Configuración del reloj para las animaciones
    const clock = new THREE.Clock();

    // Función de animación
    function animate() {
      animationFrameId = requestAnimationFrame(animate); // Llama a la función en cada frame
      const delta = clock.getDelta(); // Delta de tiempo entre frames

      if (mixer) mixer.update(delta); // Actualiza las animaciones

      if (analyser) {
        analyser.getByteFrequencyData(audioDataArray); // Obtiene los datos de frecuencia
        const avgFrequency = audioDataArray.reduce((a, b) => a + b, 0) / audioDataArray.length; // Calcula la frecuencia promedio
        const scaleFactor = Math.max(1 + avgFrequency / 256, 1); // Factor de escala basado en la frecuencia

        spheresRef.current.forEach((sphere) => {
          const targetScale = sphere.originalScale.clone().multiplyScalar(scaleFactor); // Ajusta la escala
          sphere.scale.lerp(targetScale, 0.1); // Interpola hacia la nueva escala
        });
      } else {
        spheresRef.current.forEach((sphere) => {
          sphere.scale.lerp(sphere.originalScale, 0.05); // Vuelve a la escala original
        });
      }

      composer.render(); // Renderiza la escena con el composer
    }

    animate(); // Inicia la animación

    // Función para manejar el redimensionamiento de la ventana
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight; // Actualiza el aspecto de la cámara
      camera.updateProjectionMatrix(); // Actualiza la matriz de proyección
      renderer.setSize(window.innerWidth, window.innerHeight); // Ajusta el tamaño del renderer
      composer.setSize(window.innerWidth, window.innerHeight); // Ajusta el tamaño del composer
    };
    window.addEventListener('resize', handleResize); // Añade el evento de redimensionamiento

    // Cleanup cuando el componente se desmonta
    return () => {
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement); // Elimina el canvas
      }

      cancelAnimationFrame(animationFrameId); // Cancela la animación

      window.removeEventListener('resize', handleResize); // Elimina el evento de redimensionamiento

      renderer.dispose(); // Libera los recursos del renderer
      composer.dispose(); // Libera los recursos del composer
      spheresRef.current = []; // Limpia las referencias de las esferas
    };
  }, [analyser]); // Depende del estado del analizador

  // Función para activar el micrófono y obtener los datos de audio
  const startMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); // Activa el micrófono
      const audioContext = new (window.AudioContext || window.webkitAudioContext)(); // Crea un contexto de audio
      const source = audioContext.createMediaStreamSource(stream); // Crea una fuente de audio
      const analyserNode = audioContext.createAnalyser(); // Crea un analizador de audio
      analyserNode.fftSize = 256; // Configura la FFT
      const bufferLength = analyserNode.frequencyBinCount; // Tamaño del buffer
      const dataArray = new Uint8Array(bufferLength); // Crea un array para almacenar los datos de audio
      source.connect(analyserNode); // Conecta la fuente al analizador

      setAnalyser(analyserNode); // Almacena el analizador
      setAudioDataArray(dataArray); // Almacena los datos de audio
      console.log('Micrófono activado'); // Mensaje de confirmación
    } catch (error) {
      console.error('Error al acceder al micrófono:', error); // Manejo de errores
    }
  };

  // Función para detener el micrófono
  const stopMicrophone = () => {
    setAnalyser(null); // Limpia el analizador de audio
    console.log('Micrófono desactivado'); // Mensaje de confirmación
  };

  return (
    <div className='div-canva'>
      <div ref={mountRef}></div> {/* Contenedor del canvas de Three.js */}
    </div>
  );
}

export default Animacion;
