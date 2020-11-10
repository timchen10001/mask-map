'use strict';

// prettier-ignore
const counties = ["", "基隆市", "臺北市", "新北市", "新竹市", "宜蘭縣",  "桃園市", "新竹縣", "苗栗縣", "高雄市", "臺南市", "嘉義縣", "雲林縣", "嘉義市", "南投縣", "彰化縣", "臺中市", "花蓮縣", "臺東縣", "澎湖縣", "屏東縣", "金門縣", "連江縣"];

class Data {
  #data;
  #position_coords;
  #CountyMap = {};

  constructor(coords, result) {
    this.#position_coords = coords;
    this.#data = result;
    this._initData(result);
  }

  _initData(r) {
    r.map(e => {
      const info = e['properties'];
      if (this.#CountyMap[`${info.county}`] === undefined) {
        this.#CountyMap[`${info.county}`] = new Map();
        // this.#counties.push(info.county);
      } else if (this.#CountyMap[`${info.county}`].has(info.town)) {
        this.#CountyMap[`${info.county}`].get(info.town).push(e);
      } else {
        this.#CountyMap[`${info.county}`].set(info.town, new Array());
      }
    });
  }

  distance(a, b) {
    let ssr = 0;
    for (let i = 0; i < 2; i++) {
      ssr += Math.pow(a[i] - b[i], 2);
    }
    return ssr;
  }

  setLocalCoors(coors) {
    this.#position_coords = coors;
  }

  getTotalData() {
    return this.#CountyMap;
  }
}

// Application 結構
const form = document.querySelector('.form');
const containerMasks = document.querySelector('.masks');
const containerMask = document.querySelector('.mask');
const inputType = document.querySelector('.form__input--type');
const typeOptions = document.querySelectorAll('.form__input--type option');
const inputCounty = document.querySelector('.form__input--county');
const inputTown = document.querySelector('.form__input--town');
const inputRoad = document.querySelector('.form__input--road');

class App {
  #map;
  #eventState;
  #mapZoomLevel = 15;
  #dataController;
  #datas = [];
  #pharmacies = [];
  #selected = [];
  constructor() {
    // init function
    this._initApp();

    // 設置 事件監聽 處理
    inputType.addEventListener('change', this._toggleTypeFields);
    inputCounty.addEventListener('change', this._updateState);
    inputTown.addEventListener('change', this._updateTownState);
    form.addEventListener('submit', this._filtePharmacy);
  }

  _initApp() {
    fetch(
      'https://raw.githubusercontent.com/kiang/pharmacies/master/json/points.json'
    )
      .then(response => response.json())
      .then(result => {
        console.log(`fetch done.`);
        // 將 fetch 到資料放入 App 資料結構中
        this.#datas = result['features'];

        // 進行下面流程，取得使用者位置。
        this._getPosition();
      })
      .catch(e => console.log(e));
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('沒有定位，無法查詢');
        }
      );
    }
  }

  _getEventState() {
    return this.#eventState;
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    const position_coords = [latitude, longitude];

    // 初始化地圖
    this.#map = L.map('map').setView(position_coords, this.#mapZoomLevel);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    this.#map.on('click', e => console.log(e));

    // 取得 整理過的 藥局物件
    this.#dataController = new Data(position_coords, this.#datas);

    this._renderCountySelections(this.#dataController.getTotalData());
  }

  setView(position_coords, zoomBig = false) {
    const zoomLevel = zoomBig ? this.#mapZoomLevel + 1 : this.#mapZoomLevel;
    this.#map.setView(position_coords, zoomLevel, {
      animate: true,
      pan: {
        duration: 2,
      },
    });
  }

  _updateState() {
    while (inputTown.firstElementChild) {
      inputTown.removeChild(inputTown.firstElementChild);
    }
    const countyOptions = document.querySelectorAll(
      '.form__input--county option'
    );
    const countyArr = Array.from(countyOptions);
    const selectedCounty = countyArr.filter(option => option.selected)[0].value;
    app.#selected[0] = selectedCounty;
    const HashData = app.#dataController.getTotalData();
    
    inputTown.insertAdjacentHTML('beforeend', `<option value=''></option>`);
    for (let key of HashData[selectedCounty].entries()) {
      const html = `<option value=${key[0]}>${key[0]}</option>`;
      inputTown.insertAdjacentHTML('beforeend', html);
    }
  }

  _updateTownState() {
    const townOptions = document.querySelectorAll('.form__input--town option');
    const townArr = Array.from(townOptions);
    const selectedTown = townArr.filter(option => option.selected)[0].value;
    app.#selected[1] = selectedTown;
    const coors = app.#dataController.getTotalData();
    const targetArrs = coors[app.#selected[0]]?.get(selectedTown);
    app._calcCoordinates(targetArrs);
    app._renderMarks();
  }

  _calcCoordinates(targetArrs) {
    let coors = [0, 0];
    let num = 0;
    targetArrs.map(e => {
      const coor = e.geometry.coordinates;
      coors[0] += coor[1];
      coors[1] += coor[0];
      num++;
    });
    coors = coors.map(e => e / num);
    this.#pharmacies = targetArrs;
    this.setView(coors);
  }

  _renderMarks() {
    const deleteImgArr = Array.from(
      document.querySelectorAll('img.leaflet-marker-icon')
    );
    const deleteImgShadowArr = Array.from(
      document.querySelectorAll('img.leaflet-marker-shadow')
    );
    const deleteElements = Array.from(document.querySelectorAll('.mask'));

    deleteImgShadowArr.map(e => e.parentNode.removeChild(e));
    deleteImgArr.map(e => e.parentNode.removeChild(e));
    deleteElements.map(e => containerMasks.removeChild(e));

    this.#pharmacies.forEach(pharmacy => {
      if (pharmacy) {
        const coordinates = pharmacy['geometry']['coordinates'];
        const coord = [coordinates[1], coordinates[0]];
        const properties = pharmacy['properties'];
        const html = this._getHTML(coord, properties);
        containerMasks.insertAdjacentHTML('beforeend', html);
        this._renderPharmacyMarks(coord, properties);
      }
    });
    inputTown.addEventListener('change', this._renderTown);
  }

  _renderPharmacyMarks(coord, pharmacy) {
    try {
      L.marker(coord)
        .addTo(this.#map)
        .bindPopup(
          L.popup({
            maxWidth: 250,
            minWidth: 100,
            autoClose: false,
            closeOnClick: true,
            className: pharmacy.id,
          })
        )
        .setPopupContent(
          `<h2>${pharmacy.name}</h2>
      成人口罩：${pharmacy.mask_adult}<br/>
      兒童口罩：${pharmacy.mask_child}<br/>
      ${pharmacy.updated}`
        );
    } catch (e) {
      console.log(e);
    }
  }

  _renderCountySelections() {
    counties.map(e => {
      const html = `<option value=${e}>${e}</option>`;
      inputCounty.insertAdjacentHTML('beforeend', html);
    });
  }

  _getHTML(coord, prop) {
    return `
    <li class="mask" data-id="${prop.id}">
      <h1 class="mask__title">${prop.name}</h1>
      <div class="mask__adult">成人: ${prop.mask_adult}</div>
      <div class="mask__child">兒童: ${prop.mask_child}</div>
      <div class="note">${prop.note}</div>
      <div class="address">${prop.address}</div>
      <div class="phone">${prop.phone}</div>
      <div class="updated">${prop.updated}</div>
      <div class="coordinates--latitude hide">${coord[0]}</div>
      <div class="coordinates--longitude hide">${coord[1]}</div>
    </li>
    `;
  }

  _filtePharmacy(e) {
    e.preventDefault();

    const county = inputCounty.value;
    const town = inputTown.value;
    const road = inputRoad.value;
    const address = county + town + road;
    const sidebarItemsArr = Array.from(containerMasks.children);
    let coor = [0, 0],
      num = 0;
    sidebarItemsArr.map(e => {
      const addressTotal = e.getElementsByClassName('address')[0].innerHTML;
      const latitude = +e.getElementsByClassName('coordinates--latitude')[0]
        .innerHTML;
      const longitude = +e.getElementsByClassName('coordinates--longitude')[0]
        .innerHTML;

      if (!addressTotal.startsWith(address)) {
        e.classList.add('hide');
      } else e.classList.remove('hide');
      coor[0] += latitude;
      coor[1] += longitude;
      num++;
    });
    if (num > 0) {
      coor = coor.map(e => e / num);
      app.setView(coor, true);
    }
  }
}

const app = new App();
