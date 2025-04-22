document.addEventListener('DOMContentLoaded', () => {
    const btnAgregarTarea = document.getElementById("add-task-btn");
    const btnEliminarTarea = document.getElementById("add-delete-task-btn");
    const inputNuevaTarea = document.getElementById("new-task");
    const inputFechaTarea = document.getElementById("task-date");
    const searchInput = document.getElementById("search-input");
    const filterButtons = document.querySelectorAll(".filter-btn");
    const listas = document.querySelectorAll(".task-list");
    const hoy = new Date().toISOString().split('T')[0];
    inputFechaTarea.min = hoy;
    inputFechaTarea.title = "Fecha máxima para completar la tarea";
    
    // Estado de la aplicación
    let tareas = {
      high: [],
      medium: [],
      low: []
    };
    
    // Cargar tareas del localStorage
    cargarTareas();
    
    // Verificar mensajes vacíos al inicio
    listas.forEach(checkEmptyList);
    
    // Agregar nueva tarea
    btnAgregarTarea.addEventListener("click", agregarTarea);
    inputNuevaTarea.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        agregarTarea();
      }
    });
    
    // Eliminar tareas marcadas
    btnEliminarTarea.addEventListener("click", eliminarTareasMarcadas);
    
    // Búsqueda de tareas
    searchInput.addEventListener("input", filtrarTareasPorTexto);
    
    // Botones de filtro
    filterButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        // Remover clase active de todos los botones
        filterButtons.forEach(b => b.classList.remove("active"));
        
        // Añadir clase active al botón clickeado
        btn.classList.add("active");
        
        // Aplicar filtro según el botón
        const filtroId = btn.id;
        
        if (filtroId === "filter-all") {
          mostrarTodasLasTareas();
        } else if (filtroId === "filter-pending") {
          filtrarTareasPorEstado(false);
        } else if (filtroId === "filter-completed") {
          filtrarTareasPorEstado(true);
        }
      });
    });
    
    // Configurar eventos de arrastrar y soltar
    setupDragAndDrop();
    
    // Actualizar estado de fechas cada minuto
    actualizarEstadoFechas();
    setInterval(actualizarEstadoFechas, 60000);
    
    function agregarTarea() {
      const tareaTexto = inputNuevaTarea.value.trim();
      const prioridad = document.getElementById("priority-select").value;
      const fecha = inputFechaTarea.value;
      
      if (!tareaTexto) return;
      
      // Crear objeto de tarea
      const nuevaTarea = {
        id: Date.now().toString(),
        texto: tareaTexto,
        completada: false,
        fecha: fecha || null,
        prioridad: prioridad
      };
      
      // Agregar tarea al estado
      tareas[prioridad].push(nuevaTarea);
      
      // Guardar en localStorage
      guardarTareas();
      
      // Crear elemento de la tarea en el DOM
      const li = crearElementoTarea(nuevaTarea);
      
      const lista = document.getElementById(`${prioridad}-priority`);
      
      // Remover mensaje vacío si existe
      const emptyMessage = lista.querySelector(".empty-message");
      if (emptyMessage) {
        emptyMessage.remove();
      }
      
      lista.appendChild(li);
      inputNuevaTarea.value = "";
      inputFechaTarea.value = "";
      
      // Verificar estado de la fecha
      if (fecha) {
        actualizarEstadoFecha(li.querySelector(".task-date"), fecha);
      }
    }
    
    function crearElementoTarea(tarea) {
      const li = document.createElement("li");
      li.setAttribute("draggable", true);
      li.dataset.id = tarea.id;
      
      // Estructura básica de la tarea
      li.innerHTML = `
        <div class="task-actions">
          <input type="checkbox" ${tarea.completada ? 'checked' : ''}>
        </div>
        <div class="task-content ${tarea.completada ? 'completado' : ''}">
          <span>${tarea.texto}</span>
          ${tarea.fecha ? `<div class="task-date">${formatearFecha(tarea.fecha)}</div>` : ''}
        </div>
        <div class="task-actions">
          <button class="edit-btn" title="Editar"><i class="fas fa-edit"></i></button>
          <button class="delete-btn" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
        </div>
      `;
      
      // Configurar checkbox
      const checkbox = li.querySelector("input[type='checkbox']");
      checkbox.addEventListener("change", () => {
        const taskId = li.dataset.id;
        const prioridad = li.parentElement.dataset.priority;
        
        // Actualizar estado
        const tarea = tareas[prioridad].find(t => t.id === taskId);
        if (tarea) {
          tarea.completada = checkbox.checked;
          guardarTareas();
        }
        
        li.querySelector(".task-content").classList.toggle("completado", checkbox.checked);
      });
      
      // Configurar edición
      configurarEdicion(li);
      
      // Configurar eliminación de tarea individual
      const deleteBtn = li.querySelector(".delete-btn");
      deleteBtn.addEventListener("click", () => {
        eliminarTarea(li);
      });
      
      // Agregar eventos de arrastre
      addDragEvents(li);
      
      return li;
    }
    
    function configurarEdicion(li) {
      const span = li.querySelector(".task-content span");
      const editBtn = li.querySelector(".edit-btn");
      
      // Editar al hacer doble clic
      span.addEventListener("dblclick", () => {
        activarEdicion(span, li);
      });
      
      // Editar al hacer clic en el botón de edición
      if (editBtn) {
        editBtn.addEventListener("click", () => {
          activarEdicion(span, li);
        });
      }
    }
    
    function activarEdicion(span, li) {
      const textoActual = span.textContent;
      const contenedorTarea = span.parentElement;
      const taskId = li.dataset.id;
      const prioridad = li.parentElement.dataset.priority;
      
      // Crear input para edición
      const input = document.createElement("input");
      input.type = "text";
      input.value = textoActual;
      input.className = "edit-input";
      
      // Reemplazar el span con el input
      contenedorTarea.replaceChild(input, span);
      input.focus();
      
      // Guardar cambios al presionar Enter o al perder foco
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          guardarEdicion(input, contenedorTarea, taskId, prioridad);
        }
      });
      
      input.addEventListener("blur", () => {
        guardarEdicion(input, contenedorTarea, taskId, prioridad);
      });
    }
    
    function guardarEdicion(input, contenedor, taskId, prioridad) {
      const nuevoTexto = input.value.trim() || "Tarea sin nombre";
      
      // Actualizar tarea en el estado
      const tarea = tareas[prioridad].find(t => t.id === taskId);
      if (tarea) {
        tarea.texto = nuevoTexto;
        guardarTareas();
      }
      
      const nuevoSpan = document.createElement("span");
      nuevoSpan.textContent = nuevoTexto;
      nuevoSpan.addEventListener("dblclick", () => {
        const li = contenedor.closest("li");
        activarEdicion(nuevoSpan, li);
      });
      
      contenedor.replaceChild(nuevoSpan, input);
    }
    
    function eliminarTarea(li) {
      const taskId = li.dataset.id;
      const prioridad = li.parentElement.dataset.priority;
      
      // Eliminar de la lista visual con animación
      li.classList.add("fade-out");
      
      setTimeout(() => {
        // Eliminar del DOM
        li.remove();
        
        // Eliminar del estado
        tareas[prioridad] = tareas[prioridad].filter(t => t.id !== taskId);
        guardarTareas();
        
        // Verificar si la lista quedó vacía
        checkEmptyList(li.parentElement);
      }, 300);
    }
    
    function eliminarTareasMarcadas() {
      listas.forEach((lista) => {
        const prioridad = lista.dataset.priority;
        
        lista.querySelectorAll("li:not(.empty-message)").forEach((tarea) => {
          const checkbox = tarea.querySelector("input[type='checkbox']");
          if (checkbox && checkbox.checked) {
            const taskId = tarea.dataset.id;
            
            // Eliminar del estado
            tareas[prioridad] = tareas[prioridad].filter(t => t.id !== taskId);
            
            // Eliminar del DOM con animación
            tarea.classList.add("fade-out");
            setTimeout(() => {
              tarea.remove();
              checkEmptyList(lista);
            }, 300);
          }
        });
        
        // Guardar cambios
        guardarTareas();
        
        // Verificar listas vacías
        checkEmptyList(lista);
      });
    }
    
    function addDragEvents(elemento) {
      elemento.addEventListener("dragstart", (e) => {
        elemento.classList.add("dragging");
        
        // Guardar el ID y la prioridad original para reordenar dentro de la misma lista
        e.dataTransfer.setData("taskId", elemento.dataset.id);
        e.dataTransfer.setData("sourcePriority", elemento.parentElement.dataset.priority);
      });
      
      elemento.addEventListener("dragend", () => {
        elemento.classList.remove("dragging");
        
        // Animar al soltar
        elemento.classList.add("task-dropped");
        setTimeout(() => {
          elemento.classList.remove("task-dropped");
        }, 300);
        
        // Verificar listas vacías
        listas.forEach(checkEmptyList);
        
        // Actualizar estado y guardar
        actualizarEstadoDespuesDeArrastre();
      });
    }
    
    function actualizarEstadoDespuesDeArrastre() {
      // Reconstruir el estado de las tareas desde el DOM
      tareas = { high: [], medium: [], low: [] };
      
      listas.forEach(lista => {
        const prioridad = lista.dataset.priority;
        
        lista.querySelectorAll("li:not(.empty-message)").forEach((li, index) => {
          const taskId = li.dataset.id;
          const texto = li.querySelector(".task-content span").textContent;
          const completada = li.querySelector("input[type='checkbox']").checked;
          const fechaEl = li.querySelector(".task-date");
          const fecha = fechaEl ? extraerFechaDeTexto(fechaEl.textContent) : null;
          
          tareas[prioridad].push({
            id: taskId,
            texto: texto,
            completada: completada,
            fecha: fecha,
            prioridad: prioridad
          });
        });
      });
      
      // Guardar el nuevo estado
      guardarTareas();
    }
    
    function setupDragAndDrop() {
      listas.forEach((lista) => {
        // Resaltar al pasar por encima
        lista.addEventListener("dragover", (e) => {
          e.preventDefault();
          lista.parentElement.classList.add("dragover");
          
          const tareaArrastrando = document.querySelector(".dragging");
          if (!tareaArrastrando) return;
          
          // Determinar posición para insertar dentro de la misma lista
          const posicionTarea = getPosicionTareaEnArrastre(lista, e.clientY);
          
          if (posicionTarea !== null) {
            const elementoDespues = posicionTarea.elemento;
            if (elementoDespues) {
              lista.insertBefore(tareaArrastrando, elementoDespues);
            } else {
              lista.appendChild(tareaArrastrando);
            }
          }
        });
        
        lista.addEventListener("dragleave", () => {
          lista.parentElement.classList.remove("dragover");
        });
        
        lista.addEventListener("drop", (e) => {
          e.preventDefault();
          lista.parentElement.classList.remove("dragover");
          
          const tareaArrastrando = document.querySelector(".dragging");
          if (!tareaArrastrando) return;
          
          const taskId = e.dataTransfer.getData("taskId");
          const sourceList = e.dataTransfer.getData("sourcePriority");
          const targetList = lista.dataset.priority;
          
          // Si la tarea se mueve a otra lista (cambio de prioridad)
          if (sourceList !== targetList) {
            // Actualizar prioridad en el modelo de datos
            const tareaIndex = tareas[sourceList].findIndex(t => t.id === taskId);
            if (tareaIndex !== -1) {
              const tarea = tareas[sourceList][tareaIndex];
              tarea.prioridad = targetList;
              tareas[sourceList].splice(tareaIndex, 1);
              tareas[targetList].push(tarea);
            }
          }
          
          // Eliminar mensaje vacío si existe
          const emptyMessage = lista.querySelector(".empty-message");
          if (emptyMessage) {
            emptyMessage.remove();
          }
          
          // La tarea ya está en la lista correcta gracias al dragover
          // Solo hay que guardar el orden final
        });
      });
    }
    
    function getPosicionTareaEnArrastre(lista, posicionY) {
      const elementosTarea = [...lista.querySelectorAll("li:not(.dragging):not(.empty-message)")];
      
      if (elementosTarea.length === 0) {
        return { elemento: null, offset: 0 };
      }
      
      let elementoCercano = null;
      let distanciaMinima = Number.POSITIVE_INFINITY;
      
      elementosTarea.forEach(elemento => {
        const box = elemento.getBoundingClientRect();
        const boxCentro = box.top + box.height / 2;
        const distancia = Math.abs(boxCentro - posicionY);
        
        if (distancia < distanciaMinima) {
          distanciaMinima = distancia;
          elementoCercano = elemento;
        }
      });
      
      const elementoArrastrando = document.querySelector(".dragging");
      const boxArrastrando = elementoArrastrando ? elementoArrastrando.getBoundingClientRect() : null;
      const boxCercano = elementoCercano ? elementoCercano.getBoundingClientRect() : null;
      
      if (boxCercano && boxArrastrando && posicionY < boxCercano.top + boxCercano.height / 2) {
        return { elemento: elementoCercano, offset: -1 };
      } else if (elementoCercano) {
        return { elemento: elementoCercano.nextElementSibling, offset: 1 };
      } else {
        return { elemento: null, offset: 0 };
      }
    }
    
    function checkEmptyList(lista) {
      // Si es una NodeList, manejar cada lista
      if (NodeList.prototype.isPrototypeOf(lista)) {
        lista.forEach(checkEmptyList);
        return;
      }
      
      // No hay tareas reales (excluyendo el mensaje vacío)
      const tareas = lista.querySelectorAll("li:not(.empty-message)");
      
      if (tareas.length === 0) {
        // Verificar si ya existe un mensaje vacío
        const emptyExists = lista.querySelector(".empty-message");
        if (!emptyExists) {
          const emptyMessage = document.createElement("li");
          emptyMessage.className = "empty-message";
          emptyMessage.textContent = "Sin tareas en esta categoría";
          lista.appendChild(emptyMessage);
        }
      }
    }
    
    function guardarTareas() {
      localStorage.setItem("tareas", JSON.stringify(tareas));
    }
    
    function cargarTareas() {
      const tareasGuardadas = localStorage.getItem("tareas");
      
      if (tareasGuardadas) {
        tareas = JSON.parse(tareasGuardadas);
        
        // Renderizar tareas guardadas
        Object.keys(tareas).forEach(prioridad => {
          const lista = document.getElementById(`${prioridad}-priority`);
          
          // Parece que el archivo fue cortado. Aquí está la continuación:

            // Limpiar lista
            lista.innerHTML = "";
            
            if (tareas[prioridad].length === 0) {
              const emptyMessage = document.createElement("li");
              emptyMessage.className = "empty-message";
              emptyMessage.textContent = "Sin tareas en esta categoría";
              lista.appendChild(emptyMessage);
            } else {
              tareas[prioridad].forEach(tarea => {
                const li = crearElementoTarea(tarea);
                lista.appendChild(li);
                
                // Actualizar estado de fecha si existe
                if (tarea.fecha) {
                  const fechaEl = li.querySelector(".task-date");
                  if (fechaEl) {
                    actualizarEstadoFecha(fechaEl, tarea.fecha);
                  }
                }
              });
            }
          });
        }
      }
      
      function formatearFecha(fechaISO) {
        if (!fechaISO) return "";
        
        const fecha = new Date(fechaISO);
        return fecha.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
      
      function extraerFechaDeTexto(texto) {
        // Extrae la fecha del formato DD/MM/YYYY
        const matches = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (matches && matches.length > 3) {
          const [_, dia, mes, anio] = matches;
          return `${anio}-${mes}-${dia}`;
        }
        return null;
      }
      
      function actualizarEstadoFechas() {
        document.querySelectorAll(".task-date").forEach(fechaEl => {
          const fechaTexto = fechaEl.textContent;
          const fecha = extraerFechaDeTexto(fechaTexto);
          if (fecha) {
            actualizarEstadoFecha(fechaEl, fecha);
          }
        });
      }
      
      function actualizarEstadoFecha(elementoFecha, fecha) {
        // Limpiar clases anteriores
        elementoFecha.classList.remove("due-soon", "overdue");
        
        // Convertir a objetos Date
        const fechaTarea = new Date(fecha);
        const hoy = new Date();
        
        // Establecer horas a 0 para comparar solo fechas
        hoy.setHours(0, 0, 0, 0);
        fechaTarea.setHours(0, 0, 0, 0);
        
        // Calcular diferencia en días
        const diferenciaDias = Math.round((fechaTarea - hoy) / (1000 * 60 * 60 * 24));
        
        // Aplicar clases según la proximidad
        if (diferenciaDias < 0) {
          elementoFecha.classList.add("overdue");
        } else if (diferenciaDias <= 2) {
          elementoFecha.classList.add("due-soon");
        }
      }
      
      function filtrarTareasPorTexto() {
        const textoBusqueda = searchInput.value.toLowerCase();
        
        listas.forEach(lista => {
          lista.querySelectorAll("li:not(.empty-message)").forEach(li => {
            const textoTarea = li.querySelector(".task-content span").textContent.toLowerCase();
            
            if (textoTarea.includes(textoBusqueda)) {
              li.classList.remove("hidden");
            } else {
              li.classList.add("hidden");
            }
          });
          
          // Actualizar mensaje vacío según resultados visibles
          actualizarMensajeVacio(lista);
        });
      }
      
      function actualizarMensajeVacio(lista) {
        const tareasVisibles = lista.querySelectorAll("li:not(.empty-message):not(.hidden)").length;
        let emptyMessage = lista.querySelector(".empty-message");
        
        if (tareasVisibles === 0) {
          // Si no hay tareas visibles y no existe mensaje vacío, crear uno
          if (!emptyMessage) {
            emptyMessage = document.createElement("li");
            emptyMessage.className = "empty-message";
            lista.appendChild(emptyMessage);
          }
          
          // Actualizar mensaje según si hay filtro o no
          if (searchInput.value) {
            emptyMessage.textContent = "No hay coincidencias para esta búsqueda";
          } else {
            emptyMessage.textContent = "Sin tareas en esta categoría";
          }
        } else if (emptyMessage) {
          // Si hay tareas visibles y existe un mensaje vacío, eliminarlo
          emptyMessage.remove();
        }
      }
      
      function mostrarTodasLasTareas() {
        // Mostrar todas las tareas
        document.querySelectorAll("li:not(.empty-message)").forEach(li => {
          li.classList.remove("hidden");
        });
        
        // Actualizar mensajes vacíos
        listas.forEach(actualizarMensajeVacio);
      }
      
      function filtrarTareasPorEstado(completadas) {
        document.querySelectorAll("li:not(.empty-message)").forEach(li => {
          const checkbox = li.querySelector("input[type='checkbox']");
          
          if (checkbox.checked === completadas) {
            li.classList.remove("hidden");
          } else {
            li.classList.add("hidden");
          }
        });
        
        // Actualizar mensajes vacíos
        listas.forEach(actualizarMensajeVacio);
      }
});