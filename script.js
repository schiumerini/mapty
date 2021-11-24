'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // km
    this.duration = duration; // min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase() + this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  _formateIcon() {
    this.icon = `${this.type === 'running' ? '🏃' : '🚴'}`;
    return this.icon;
  }

  _click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
    this._formateIcon();
  }

  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
    this._formateIcon();
  }

  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
  }
}

////////////////////////////////
// Application Architecture
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField.bind(this));
    containerWorkouts.addEventListener(
      'click',
      this._focusWorkoutMarker.bind(this)
    );
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert(
            'Could not get your position. Please allow this site to access your location'
          );
        }
      );
    }
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    const coords = [latitude, longitude];
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(workout => {
      this._renderWorkoutMarker(workout);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
    this._clearForm();
  }

  _showEditForm(mapE, type, dist, min, cad, ele) {
    this._showForm(mapE);
    inputType.value = type;
    inputDistance.value = dist;
    inputDuration.value = min;
    if (!ele) {
      inputCadence.value = cad;
      inputElevation.closest('.form__row').classList.add('form__row--hidden');
      inputCadence.closest('.form__row').classList.remove('form__row--hidden');
    } else {
      inputElevation.value = ele;
      inputElevation
        .closest('.form__row')
        .classList.remove('form__row--hidden');
      inputCadence.closest('.form__row').classList.add('form__row--hidden');
    }
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _focusWorkoutMarker(e) {
    if (e.target.id === 'delete-button') {
      const workout = this.#workouts.find(
        work => work.id === e.target.closest('.workout').dataset.id
      );
      this._deleteWorkout(workout);
      return;
    }
    if (e.target.id === 'edit-button') {
      const workout = this.#workouts.find(
        work => work.id === e.target.closest('.workout').dataset.id
      );
      this._editWorkout(workout);
      return;
    }
    if (e.target.id === 'deleteAll-button') {
      this.reset();
      return;
    }

    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;
    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id // OR "workoutEl.getAttribute('data-id')""
    );
    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    this._showEditForm(
      e,
      workout.type,
      workout.distance,
      workout.duration,
      workout.cadence,
      workout.elevationGain
    );
    // Using the public interface
    //workout._click(); // Will not work unless refactor data in "_getLocalStorage" to be reverted back to running/cycling classes
  }

  _newWorkout(e) {
    e.preventDefault();
    const validInputs = (...inputs) =>
      inputs.every(imp => Number.isFinite(imp));
    const allPositive = (...inputs) => inputs.every(imp => imp > 0);
    // Get data from form
    const type = inputType.value;
    const dist = +inputDistance.value;
    const dur = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout running, create running object
    if (type === 'running') {
      const cad = +inputCadence.value;
      // Check if data is valid
      if (!validInputs(dist, dur, cad) || !allPositive(dist, dur, cad))
        return alert('Inputs have to be positive numbers!');
      workout = new Running([lat, lng], dist, dur, cad);
    }
    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const ele = +inputElevation.value;
      // Check if data is valid
      if (!validInputs(dist, dur, ele) || !allPositive(dist, dur))
        return alert('Inputs have to be positive numbers!');
      workout = new Cycling([lat, lng], dist, dur, ele);
    }

    // Add new object to workout array
    this.#workouts.push(workout);

    // Sort by distance
    this._sortWorkouts();
    this.#map.remove();
    containerWorkouts.querySelectorAll('.workout').forEach(e => e.remove());
    this._getPosition();
    this._getLocalStorage();

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + Clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    const type = workout.type;

    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${type}-popup`,
        })
      )
      .setPopupContent(`${workout.icon} ${workout.description}`)
      .openPopup();
  }

  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
      <h2 class="workout__title">${workout.description}<button type="submit" id="delete-button">Delete</button><button type="submit" id="edit-button">Edit</button></h2>
      <div class="workout__details">
        <span class="workout__icon">${workout.icon}</span>
        <span class="workout__value">${workout.distance}</span>
        <span class="workout__unit">km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⏱</span>
        <span class="workout__value">${workout.duration}</span>
        <span class="workout__unit">min</span>
      </div>`;

    if (workout.type === 'running') {
      html += `
      <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.pace.toFixed(1)}</span>
        <span class="workout__unit">min/km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">🦶🏼</span>
        <span class="workout__value">${workout.cadence}</span>
        <span class="workout__unit">spm</span>
      </div>
    </li>`;
    } else {
      html += `
      <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.speed.toFixed(1)}</span>
        <span class="workout__unit">km/h</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⛰</span>
        <span class="workout__value">${workout.elevationGain}</span>
        <span class="workout__unit">m</span>
      </div>
    </li>`;
    }

    form.insertAdjacentHTML('afterend', html);
  }

  _hideForm() {
    this._clearForm();
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _clearForm() {
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;
    this.#workouts = data;
    this.#workouts.forEach(workout => {
      this._renderWorkout(workout);
    });
  }

  _sortWorkouts() {
    console.log('Workouts Sorted');
    this.#workouts.sort((a, b) => a.distance - b.distance);
    this._setLocalStorage();
  }

  _editWorkout(workout) {
    console.log('Workout Editted');
    let data = JSON.parse(localStorage.getItem('workouts'));
    data.forEach(function (work) {
      if (work.id === workout.id) {
        work.distance = inputDistance.value;
        work.duration = inputDuration.value;
        work.cadence = inputCadence.value;
        work.elevationGain = inputElevation.value;
        if (work.type === 'running') {
          work.pace = work.duration / work.distance;
        } else {
          work.speed = work.distance / (work.duration / 60);
        }
      }
    });
    this.#workouts = data;
    this._setLocalStorage();
    this._sortWorkouts();
    this.#map.remove();
    containerWorkouts.querySelectorAll('.workout').forEach(e => e.remove());
    this._getPosition();
    this._getLocalStorage();
  }

  _deleteWorkout(workout) {
    console.log('Workout Deleted');
    let data = JSON.parse(localStorage.getItem('workouts'));
    data = data.filter(work => work.id != workout.id);
    this.#workouts = data;
    this._setLocalStorage();
    this.#map.remove();
    containerWorkouts.querySelectorAll('.workout').forEach(e => e.remove());
    this._getPosition();
    this._getLocalStorage();
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload;
    this.#workouts = [];
    this._setLocalStorage();
    this.#map.remove();
    containerWorkouts.querySelectorAll('.workout').forEach(e => e.remove());
    this._getPosition();
    this._getLocalStorage();
  }
}

const app = new App();

//////////////////////////
// Additional feature challenges:
// - [x] 1) Edit/Delete/DeleteAll workout(s)
// - [x] 2) Sort workouts by a certain field (e.g. distance)
// - [x] 3) Rebuild Running/Cycling objects from the Local Storage
// - [ ] 4) Add more realistic Error messages
// - [ ] 5) Ability to position the map to show all workouts [very hard]
// - [ ] 6) Ability to draw lines and shapes instead of just points [very hard]
// - [ ] 7) Geocode location from coordinates ("Run in Faro, Portuhal") [only after asynchronous JavaScript section]
// - [ ] 8) Display weather data for workout time and place [only after asynchronous JavaScript section]
