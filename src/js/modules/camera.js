import * as mobilenet from '@tensorflow-models/mobilenet';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { fabric } from 'fabric';
import { handleError } from './helpers';
import * as templates from './templates';
import * as ui from './ui';

export function clearPhoto() {
  const canvas = new fabric.Canvas('.canvas');
  const rect = new fabric.Rect({
    backgroundColor: '#aaa',
    top: 0,
    left: 0,
    width: canvas.getWidth(),
    height: canvas.getHeight(),
  });
  ui.destroyTooltips();
  canvas.add(rect);
}

export function takePhoto() {
  const canvas = document.querySelector('.canvas');
  const player = document.querySelector('.player');
  const context = canvas.getContext('2d');
  const playerWidth = player.offsetWidth;
  const playerHeight = player.offsetHeight;

  canvas.width = playerWidth;
  canvas.height = playerHeight;
  context.drawImage(player, 0, 0, playerWidth, ((playerWidth * playerHeight) / playerWidth));
  canvas.setAttribute('style', 'width: 100%; height: auto;');
}

export function stopVideoCamera(videoPlayerSelector) {
  const videoPlayer = document.querySelector(videoPlayerSelector);
  videoPlayer.srcObject.getVideoTracks().forEach((track) => track.stop());
}

export async function startCamera() {
  ui.populateElementWithMarkup('.app', templates.cameraMarkup);
  ui.destroyTooltips();

  let streaming = false;

  try {
    const player = document.querySelector('.player');
    const mediaDeviceConstraints = {
      audio: false,
      video: {
        facingMode: 'environment',
      },
    };
    const userMediaStream = await navigator.mediaDevices.getUserMedia(mediaDeviceConstraints);
    player.srcObject = userMediaStream;
    player.play();
    player.setAttribute('style', 'width: 100%; height: auto;');
  } catch (error) {
    handleError(error);
  }

  const drawBoundingBox = async (prediction, isHidden = false) => {
    const wrapper = document.querySelector('.canvas-wrapper');
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.border = '2px solid rgb(223, 105, 25)';
    div.style.backgroundColor = 'rgba(255, 255, 255, 0.25)';
    div.style.left = `${Math.round(prediction.bbox[0])}px`;
    div.style.top = `${Math.round(prediction.bbox[1])}px`;
    div.style.width = `${Math.round(prediction.bbox[2])}px`;
    div.style.height = `${Math.round(prediction.bbox[3])}px`;
    div.setAttribute('data-tippy-content', `
      <span class='badge badge-primary text-uppercase'>
        ${prediction.class}
        <span class='bg-white text-primary' style='margin-left: .35em; padding: 0 .5em;'>${Math.round(prediction.score * 100)}%</span>
      </span>
    `);
    div.classList.add('has-tooltip');
    div.classList.add('identified-object');
    if (isHidden) {
      div.classList.add('d-none');
    }
    wrapper.appendChild(div);
    ui.initTooltips();
    return div;
  };

  const handlePredictions = (predictions, isMobilenet = false) => {
    const resultsMarkup = templates.getResultsMarkup(predictions, isMobilenet);

    if (!isMobilenet) {
      predictions.map((prediction) => drawBoundingBox(prediction));
      // drawBoundingBox(predictions[0]);
      // predictions.slice(1).map((prediction, true) => {
      //   drawBoundingBox(prediction);
      // });
      ui.showTooltip('.identified-object');
    }

    ui.hideElement('.btnTakePhoto');
    ui.populateElementWithMarkup('.results', resultsMarkup);
    ui.initElementEventHandler('.btnStartOver', 'click', startCamera);
  };

  const detectObjects = async (image) => {
    let detections = null;

    try {
      const model = await cocoSsd.load('mobilenet_v2'); // lite_mobilenet_v2
      detections = await model.detect(image, 10);
    } catch (error) {
      handleError(error);
    }

    return detections;
  };

  const classifyImage = async (image) => {
    let classifications = null;

    try {
      const model = await mobilenet.load({
        version: 2,
        alpha: 1.00,
      });
      classifications = await model.classify(image, 10);
    } catch (error) {
      handleError(error);
    }

    return classifications;
  };

  const takePhotoClickHandler = async () => {
    takePhoto();
    stopVideoCamera('.player');
    ui.hideElement('.player');
    ui.showElement('.canvas');
    ui.showElement('.results');
    ui.disableButton('.btnTakePhoto', '<i class="fad fa-sync fa-spin"></i> identifying ...');

    const canvas = document.querySelector('.canvas');
    const predictions = await detectObjects(canvas);

    if (predictions.length) {
      handlePredictions(predictions);
    } else {
      const morePredictions = await classifyImage(canvas);
      handlePredictions(morePredictions, true);
    }
  };

  ui.initElementEventHandler('.player', 'canplay', () => {
    const player = document.querySelector('.player');
    const canvas = document.querySelector('.canvas');
    if (!streaming) {
      canvas.setAttribute('width', player.offsetWidth);
      canvas.setAttribute('height', player.offsetHeight);
      streaming = true;
    }
  });
  ui.initElementEventHandler('.btnTakePhoto', 'click', takePhotoClickHandler);
  ui.initElementEventHandler('.player', 'click', takePhotoClickHandler);
}
