// src/utils/chartSetup.ts

import {
    Chart,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
  } from "chart.js";
  
  // Registrazione dei componenti necessari per react-chartjs-2
  Chart.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);