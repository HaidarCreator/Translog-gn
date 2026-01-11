import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  Truck, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Package, 
  Save, 
  Trash2,
  Filter,
  X,
  Menu,
  Droplet,
  Settings, 
  Edit3,
  MapPin,
  BarChart3, 
  List,     
  PieChart,
  Wrench,
  Wallet,
  Sparkles, 
  Loader,   
  Camera    
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot 
} from 'firebase/firestore';

// --- Global Constants (Initial Defaults) ---
const DEFAULT_BAG_WEIGHT_KG = 50;
const DEFAULT_REVENUE_PER_TON = 85000;
const DEFAULT_LABOR_PER_TON = 15000;
const DEFAULT_FUEL_PRICE = 12000; 

// System provides this at runtime in the preview environment
const API_KEY = ""; 

// --- Firebase Initialization ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Guinean Locations Database ---
const GUINEA_LOCATIONS = [
  // Conakry
  "Kaloum", "Dixinn", "Matam", "Ratoma", "Matoto", 
  "Madina", "Kipé", "Lambanyi", "Taouyah", "Nongo", 
  "Cosa", "Bambeto", "Hamdallaye", "Sonfonia", "Enta", 
  "Sangoyah", "Gbessia", "Simbaya", "Yimbaya", "Tombolia",
  "Dabompa", "Lansanayah", "Kountia",
  // Dubréka
  "Dubréka Centre", "Kagbelen", "Km5", "Tanéné", 
  "Khorira", "Ouassou", "Bondabon", "Tondon",
  // Coyah
  "Coyah Centre", "Manéah", "Wonkifong", "Kouriah", 
  "Sombayah", "Bentourayah", "Km36", "Gombonya", "Fassia"
].sort();

// --- Helper Functions ---
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-GN', { 
    style: 'currency', 
    currency: 'GNF',
    maximumFractionDigits: 0 
  }).format(amount);
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-GB');
};

// --- GEMINI API HELPERS ---

// 1. Text Generation for Business Report
const generateGeminiReport = async (tripsData) => {
  try {
    const prompt = `
      You are a logistics business analyst for a cement company in Guinea. 
      Analyze the following trip data (JSON). Currency is GNF.
      
      Data: ${JSON.stringify(tripsData.slice(0, 30))} (Truncated for brevity)

      Please provide a concise but insightful report with the following sections (use Markdown):
      1. **Financial Summary**: Net profit trends and margins.
      2. **Operational Efficiency**: Which truck or route is performing best?
      3. **Cost Analysis**: Are fuel or maintenance costs rising?
      4. **Recommendation**: One specific action to improve profitability.
      
      Keep it professional, encouraging, and brief (under 200 words).
    `;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Could not generate report.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error connecting to AI service. Please try again.";
  }
};

// 2. Image Understanding for Receipt Scanning
const scanReceiptWithGemini = async (base64Image) => {
  try {
    const prompt = `
      Look at this receipt image. Extract the following details and return ONLY a valid JSON object. Do not include Markdown formatting or backticks.
      
      Fields to extract:
      - "date": The date found on the receipt (format YYYY-MM-DD). If not found, use today's date.
      - "amount": The total amount (number only, remove currency symbols).
      - "description": A short summary of items purchased (e.g., "Fuel", "Tire Repair").
      
      JSON Structure:
      { "date": "...", "amount": 0, "description": "..." }
    `;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { mimeType: "image/png", data: base64Image } } // Assuming PNG/JPEG, API handles generic types well
            ]
          }],
          generationConfig: { responseMimeType: "application/json" } // Force JSON response
        })
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    throw new Error("Could not scan receipt.");
  }
};


// --- Components ---

const StatCard = ({ title, value, subtext, icon: Icon, colorClass }) => (
  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-start space-x-4">
    <div className={`p-3 rounded-lg ${colorClass} bg-opacity-10`}>
      <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
    </div>
    <div>
      <p className="text-slate-500 text-sm font-medium">{title}</p>
      <h3 className="text-xl font-bold text-slate-800 mt-1">{value}</h3>
      {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
    </div>
  </div>
);

const SettingsModal = ({ config, onSave, onClose }) => {
  const [localConfig, setLocalConfig] = useState(config);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(localConfig);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
        <div className="bg-slate-800 px-6 py-4 flex justify-between items-center">
          <h2 className="text-white font-bold text-lg flex items-center">
            <Settings className="w-5 h-5 mr-2" /> App Settings
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fuel Price (GNF/Liter)</label>
            <input 
              type="number" 
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              value={localConfig.fuelPrice}
              onChange={(e) => setLocalConfig({...localConfig, fuelPrice: Number(e.target.value)})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Revenue per Ton (GNF)</label>
            <input 
              type="number" 
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              value={localConfig.revenuePerTon}
              onChange={(e) => setLocalConfig({...localConfig, revenuePerTon: Number(e.target.value)})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Labor Cost per Ton (GNF)</label>
            <input 
              type="number" 
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              value={localConfig.laborPerTon}
              onChange={(e) => setLocalConfig({...localConfig, laborPerTon: Number(e.target.value)})}
            />
          </div>
          
          <div className="pt-4 flex space-x-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium shadow-md"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const TripForm = ({ config, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    type: 'trip',
    truckNumber: '',
    destination: '',
    date: new Date().toISOString().split('T')[0],
    bags: 700, 
    fuelLiters: 50, 
    otherCost: 0,
    otherDesc: ''
  });

  const [filteredLocations, setFilteredLocations] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleDestinationChange = (e) => {
    const input = e.target.value;
    setFormData({ ...formData, destination: input });

    if (input.length > 0) {
      const filtered = GUINEA_LOCATIONS.filter(loc => 
        loc.toLowerCase().includes(input.toLowerCase())
      );
      setFilteredLocations(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectLocation = (location) => {
    setFormData({ ...formData, destination: location });
    setShowSuggestions(false);
  };

  const weightTons = (formData.bags * DEFAULT_BAG_WEIGHT_KG) / 1000;
  const revenue = weightTons * config.revenuePerTon;
  const laborCost = weightTons * config.laborPerTon;
  const fuelCost = formData.fuelLiters * config.fuelPrice; 
  const totalExpenses = Number(fuelCost) + Number(laborCost) + Number(formData.otherCost);
  const netProfit = revenue - totalExpenses;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      // id will be generated by Firestore
      ...formData,
      weightTons,
      revenue,
      laborCost,
      fuelCost, 
      totalExpenses,
      netProfit,
      appliedRates: { ...config }, 
      timestamp: new Date(formData.date).getTime()
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-slide-up">
      <div className="bg-slate-800 px-6 py-4 flex justify-between items-center">
        <h2 className="text-white font-bold text-lg flex items-center">
          <Plus className="w-5 h-5 mr-2" /> New Trip Entry
        </h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-white">
          <X className="w-6 h-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Logistics Details</h3>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Truck Number</label>
            <input 
              required
              type="text" 
              placeholder="e.g. RC-1234-A"
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              value={formData.truckNumber}
              onChange={(e) => setFormData({...formData, truckNumber: e.target.value.toUpperCase()})}
            />
          </div>
          
          <div ref={wrapperRef}>
            <label className="block text-sm font-medium text-slate-700 mb-1">Destination</label>
            <div className="relative">
              <input 
                type="text" 
                placeholder="e.g. Coyah, Dubréka, Kaloum..."
                className="w-full p-2 pl-9 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                value={formData.destination}
                onChange={handleDestinationChange}
                onFocus={() => formData.destination && setShowSuggestions(true)}
                autoComplete="off"
              />
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              
              {showSuggestions && filteredLocations.length > 0 && (
                <ul className="absolute z-50 w-full bg-white border border-slate-300 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-xl">
                  {filteredLocations.map((loc, index) => (
                    <li 
                      key={index}
                      onClick={() => selectLocation(loc)}
                      className="px-4 py-2 hover:bg-emerald-50 cursor-pointer text-sm text-slate-700 border-b border-slate-100 last:border-0"
                    >
                      {loc}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
            <input 
              required
              type="date" 
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Number of Cement Bags</label>
            <input 
              required
              type="number" 
              min="1"
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              value={formData.bags}
              onChange={(e) => setFormData({...formData, bags: Number(e.target.value)})}
            />
            <div className="text-xs text-emerald-600 mt-1 font-medium bg-emerald-50 inline-block px-2 py-1 rounded">
              = {weightTons.toFixed(2)} Tons
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Financials (GNF)</h3>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">Rate: {config.fuelPrice/1000}k/L</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fuel Used (Liters)</label>
              <div className="relative">
                <input 
                  type="number" 
                  min="0"
                  className="w-full p-2 pl-9 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={formData.fuelLiters}
                  onChange={(e) => setFormData({...formData, fuelLiters: Number(e.target.value)})}
                />
                <Droplet className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
              <div className="text-xs text-slate-500 mt-1">
                 = <span className="font-semibold text-slate-700">{formatCurrency(fuelCost)}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Other Costs</label>
              <input 
                type="number" 
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                value={formData.otherCost}
                onChange={(e) => setFormData({...formData, otherCost: Number(e.target.value)})}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
            <input 
              type="text" 
              placeholder="e.g. Police, Tolls"
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              value={formData.otherDesc}
              onChange={(e) => setFormData({...formData, otherDesc: e.target.value})}
            />
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2 mt-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Calculated Revenue:</span>
              <span className="font-semibold text-slate-800">{formatCurrency(revenue)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Labor Cost (Auto):</span>
              <span className="text-red-500">-{formatCurrency(laborCost)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Fuel ({formData.fuelLiters}L):</span>
              <span className="text-red-500">-{formatCurrency(fuelCost)}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
              <span className="text-slate-600 font-medium">Total Expenses:</span>
              <span className="text-red-600 font-medium">-{formatCurrency(totalExpenses)}</span>
            </div>
            <div className="pt-2 flex justify-between items-center">
              <span className="font-bold text-slate-700">NET PROFIT</span>
              <span className={`font-bold text-lg ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(netProfit)}
              </span>
            </div>
          </div>
        </div>
        <div className="md:col-span-2 pt-4">
          <button 
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition-colors flex justify-center items-center"
          >
            <Save className="w-5 h-5 mr-2" /> Save Trip Record
          </button>
        </div>
      </form>
    </div>
  );
};

const ExpenseForm = ({ onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    type: 'expense',
    truckNumber: '',
    date: new Date().toISOString().split('T')[0],
    category: 'Maintenance', 
    amount: '',
    description: ''
  });

  const [isScanning, setIsScanning] = useState(false);

  // Handle file upload and AI Scan
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsScanning(true);
    
    // Convert to base64
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64String = reader.result.split(',')[1];
      
      try {
        // CALL GEMINI VISION API
        const extractedData = await scanReceiptWithGemini(base64String);
        
        // Update Form
        setFormData(prev => ({
          ...prev,
          date: extractedData.date || prev.date,
          amount: extractedData.amount || prev.amount,
          description: extractedData.description || prev.description
        }));
      } catch (err) {
        alert("Failed to scan receipt. Please enter details manually.");
      } finally {
        setIsScanning(false);
      }
    };
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const amountVal = Number(formData.amount);
    onSave({
      // id generated by Firestore
      ...formData,
      amount: amountVal,
      revenue: 0,
      weightTons: 0,
      bags: 0,
      laborCost: 0,
      fuelCost: 0,
      totalExpenses: amountVal,
      netProfit: -amountVal,
      timestamp: new Date(formData.date).getTime()
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-red-200 overflow-hidden animate-slide-up">
      <div className="bg-slate-800 px-6 py-4 flex justify-between items-center">
        <h2 className="text-white font-bold text-lg flex items-center">
          <Wallet className="w-5 h-5 mr-2 text-red-400" /> Log General Expense
        </h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-white">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="p-6 pb-0">
        {/* AI SCANNER BUTTON */}
        <div className="relative">
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            id="receipt-upload"
            onChange={handleFileChange}
          />
          <label 
            htmlFor="receipt-upload"
            className={`w-full flex items-center justify-center p-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isScanning ? 'bg-indigo-50 border-indigo-300' : 'bg-slate-50 border-slate-300 hover:border-indigo-400 hover:bg-indigo-50'}`}
          >
            {isScanning ? (
              <div className="flex items-center text-indigo-600 font-medium animate-pulse">
                <Loader className="w-5 h-5 mr-2 animate-spin" /> Analyzing Receipt with Gemini...
              </div>
            ) : (
              <div className="flex items-center text-slate-600 font-medium">
                <Sparkles className="w-5 h-5 mr-2 text-yellow-500" /> 
                <span>Tap to Scan Receipt with AI</span>
                <Camera className="w-5 h-5 ml-2 text-slate-400" />
              </div>
            )}
          </label>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4 pt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Truck Number</label>
            <input 
              required
              type="text" 
              placeholder="e.g. RC-1234-A"
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
              value={formData.truckNumber}
              onChange={(e) => setFormData({...formData, truckNumber: e.target.value.toUpperCase()})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
            <input 
              required
              type="date" 
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Expense Category</label>
            <select 
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
            >
              <option value="Maintenance">Maintenance & Repairs</option>
              <option value="Tires">Tires</option>
              <option value="Taxes">Taxes & Insurance</option>
              <option value="Fuel">Fuel (Non-Trip)</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount (GNF)</label>
            <input 
              required
              type="number" 
              min="0"
              placeholder="0"
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none font-bold"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description (Detail)</label>
          <input 
            type="text" 
            placeholder="e.g. Changed rear axle, 2 new tires"
            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
          />
        </div>

        <div className="pt-2">
          <button 
            type="submit"
            className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-6 rounded-lg shadow-md transition-colors flex justify-center items-center"
          >
            <Save className="w-5 h-5 mr-2" /> Log Expense
          </button>
        </div>
      </form>
    </div>
  );
};

const AnalyticsDashboard = ({ trips }) => {
  const sortedTrips = [...trips].sort((a, b) => new Date(a.date) - new Date(b.date));
  const maxRevenue = Math.max(...sortedTrips.map(t => t.revenue || 0), 1000000); 

  // AI Reporting State
  const [aiReport, setAiReport] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setAiReport("");
    const report = await generateGeminiReport(trips);
    setAiReport(report);
    setIsGenerating(false);
  };

  // Destination Stats
  const destStats = useMemo(() => {
    const stats = {};
    trips.filter(t => t.type === 'trip').forEach(t => {
      const d = t.destination || 'Unknown';
      if (!stats[d]) stats[d] = { count: 0, tons: 0, revenue: 0 };
      stats[d].count += 1;
      stats[d].tons += t.weightTons;
      stats[d].revenue += t.revenue;
    });
    return Object.entries(stats).sort((a, b) => b[1].tons - a[1].tons);
  }, [trips]);

  // Cost Breakdown
  const costs = useMemo(() => {
    const c = { fuel: 0, labor: 0, maintenance: 0, other: 0 };
    trips.forEach(t => {
      c.fuel += t.fuelCost || 0;
      c.labor += t.laborCost || 0;
      c.other += t.otherCost || 0;
      
      if (t.type === 'expense') {
        if (t.category === 'Fuel') c.fuel += t.amount;
        else if (t.category === 'Maintenance' || t.category === 'Tires') c.maintenance += t.amount;
        else c.other += t.amount;
      }
    });
    const total = c.fuel + c.labor + c.maintenance + c.other || 1;
    return { ...c, total };
  }, [trips]);

  return (
    <div className="space-y-6 animate-fade-in"> 
      
      {/* AI REPORT SECTION */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-800 p-6 rounded-xl shadow-lg text-white">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold flex items-center">
            <Sparkles className="w-5 h-5 mr-2 text-yellow-400" />
            AI Business Insights
          </h3>
          <button 
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center disabled:opacity-50"
          >
            {isGenerating ? <Loader className="w-4 h-4 mr-2 animate-spin"/> : "Generate AI Report"}
          </button>
        </div>
        
        {isGenerating && (
          <div className="py-8 text-center text-indigo-200 animate-pulse">
            Consulting Gemini AI to analyze your logistics data...
          </div>
        )}

        {!isGenerating && aiReport && (
          <div className="bg-white/10 p-4 rounded-lg text-sm leading-relaxed whitespace-pre-line border border-white/10 shadow-inner">
            {aiReport}
          </div>
        )}

        {!isGenerating && !aiReport && (
          <p className="text-indigo-200 text-sm">
            Click the button above to have Gemini AI analyze your profit margins, efficient routes, and suggest cost-saving measures based on your recent data.
          </p>
        )}
      </div>

      {/* Chart 1: Revenue vs Profit Trend */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2 text-emerald-600" />
          Financial Performance History
        </h3>
        
        {trips.length > 0 ? (
          <div className="h-64 flex items-end space-x-2 sm:space-x-4 overflow-x-auto pb-2 px-2">
            {sortedTrips.map((trip) => {
              const isExpense = trip.type === 'expense';
              // Fixed: Adjusted max height to 85% to accommodate labels
              const heightPercent = isExpense 
                ? Math.min((trip.totalExpenses / maxRevenue) * 85, 85)
                : Math.max((trip.revenue / maxRevenue) * 85, 1);
              
              const profitPercent = isExpense ? 0 : (trip.netProfit / trip.revenue) * 100;
              
              return (
                // Fixed: Added h-full and justify-end to prevent 0-height collapse
                <div key={trip.id} className="group relative flex-shrink-0 w-12 sm:w-16 h-full flex flex-col justify-end items-center cursor-pointer">
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs p-2 rounded z-10 w-32 text-center pointer-events-none shadow-lg">
                    <div className="font-bold">{formatDate(trip.date)}</div>
                    {isExpense ? (
                      <div className="text-red-300">Exp: {formatCurrency(trip.totalExpenses)}</div>
                    ) : (
                      <>
                        <div>Rev: {formatCurrency(trip.revenue)}</div>
                        <div>Prof: {formatCurrency(trip.netProfit)}</div>
                      </>
                    )}
                  </div>
                  
                  {/* Bars */}
                  <div 
                    className={`w-full rounded-t-sm relative flex flex-col justify-end overflow-hidden transition-colors ${isExpense ? 'bg-red-200' : 'bg-slate-200 hover:bg-slate-300'}`}
                    style={{ height: `${heightPercent}%` }}
                  >
                    {!isExpense && (
                      <div 
                        className="w-full bg-emerald-500 bg-opacity-90 absolute bottom-0 transition-all duration-500"
                        style={{ height: `${Math.max(profitPercent, 0)}%` }} 
                      />
                    )}
                  </div>
                  <div className="mt-2 text-[10px] sm:text-xs text-slate-500 font-medium rotate-0 truncate w-full text-center">
                    {new Date(trip.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg">
            No financial data available yet.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-blue-500" />
            Top Destinations (by Volume)
          </h3>
          <div className="space-y-4">
            {destStats.length > 0 ? destStats.map(([name, data], idx) => (
              <div key={name} className="relative">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-700">{name}</span>
                  <span className="text-slate-500">{data.tons.toFixed(1)} T ({data.count} trips)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5">
                  <div 
                    className="bg-blue-500 h-2.5 rounded-full" 
                    style={{ width: `${(data.tons / destStats[0][1].tons) * 100}%` }}
                  ></div>
                </div>
              </div>
            )) : (
              <p className="text-slate-400 text-sm">No destination data.</p>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <PieChart className="w-5 h-5 mr-2 text-red-500" />
            Cost Distribution
          </h3>
          <div className="space-y-6 pt-2">
            {[
              { label: 'Fuel', value: costs.fuel, color: 'bg-orange-500', text: 'text-orange-600' },
              { label: 'Labor', value: costs.labor, color: 'bg-indigo-500', text: 'text-indigo-600' },
              { label: 'Maintenance', value: costs.maintenance, color: 'bg-cyan-500', text: 'text-cyan-600' },
              { label: 'Other', value: costs.other, color: 'bg-slate-400', text: 'text-slate-500' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">{item.label}</span>
                  <span className={`font-bold ${item.text}`}>{formatCurrency(item.value)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                    <div 
                      className={`h-full ${item.color}`} 
                      style={{ width: `${(item.value / costs.total) * 100}%` }}
                    ></div>
                </div>
                <div className="text-right text-[10px] text-slate-400 mt-0.5">
                  {((item.value / costs.total) * 100).toFixed(1)}% of total
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [config, setConfig] = useState({
    fuelPrice: DEFAULT_FUEL_PRICE,
    revenuePerTon: DEFAULT_REVENUE_PER_TON,
    laborPerTon: DEFAULT_LABOR_PER_TON
  });
  
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'analytics'

  // AUTH STATE
  const [user, setUser] = useState(null);
  
  // DATA STATE - Initial state is empty array (no example data)
  const [trips, setTrips] = useState([]);
  
  const [showForm, setShowForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [filterTruck, setFilterTruck] = useState('');

  // 1. Initialize Auth
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Data from Firestore (Real-time)
  useEffect(() => {
    if (!user) return;

    // Use a private user collection for security
    const tripsCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'trips');
    
    const unsubscribe = onSnapshot(tripsCollection, (snapshot) => {
      const tripsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTrips(tripsData);
    }, (error) => {
      console.error("Error fetching trips:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const stats = useMemo(() => {
    return trips.reduce((acc, trip) => ({
      totalTrips: acc.totalTrips + (trip.type === 'trip' ? 1 : 0),
      totalTons: acc.totalTons + (trip.weightTons || 0),
      totalRevenue: acc.totalRevenue + (trip.revenue || 0),
      totalProfit: acc.totalProfit + (trip.netProfit || 0),
      totalExpenses: acc.totalExpenses + (trip.totalExpenses || 0)
    }), { totalTrips: 0, totalTons: 0, totalRevenue: 0, totalProfit: 0, totalExpenses: 0 });
  }, [trips]);

  const filteredTrips = trips.filter(trip => 
    trip.truckNumber.includes(filterTruck.toUpperCase())
  ).sort((a, b) => new Date(b.date) - new Date(a.date));

  // --- FIRESTORE ACTIONS ---

  const handleAddTrip = async (newTrip) => {
    if (!user) return;
    try {
      const tripsCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'trips');
      await addDoc(tripsCollection, newTrip);
      setShowForm(false);
    } catch (e) {
      console.error("Error adding trip: ", e);
      alert("Erreur lors de la sauvegarde.");
    }
  };
  
  const handleAddExpense = async (newExpense) => {
    if (!user) return;
    try {
      const tripsCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'trips');
      await addDoc(tripsCollection, newExpense);
      setShowExpenseForm(false);
    } catch (e) {
      console.error("Error adding expense: ", e);
      alert("Erreur lors de la sauvegarde.");
    }
  };

  const handleDeleteTrip = async (id) => {
    if (!user) return;
    try {
      if (confirm('Êtes-vous sûr de vouloir supprimer cet élément ?')) {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'trips', id);
        await deleteDoc(docRef);
      }
    } catch (e) {
      console.error("Error deleting document: ", e);
    }
  };

  const handleUpdateSettings = (newConfig) => {
    setConfig(newConfig);
    setShowSettings(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out;
        }
        .animate-slide-up {
          animation: slideUp 0.4s ease-out;
        }
      `}</style>

      {/* Navbar */}
      <nav className="bg-slate-900 text-white p-4 sticky top-0 z-50 shadow-lg">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="bg-emerald-500 p-2 rounded-lg">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">CimenLog <span className="text-emerald-400">GNF</span></h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <button className="md:hidden text-white"><Menu /></button>
            <div className="hidden md:flex text-sm text-slate-400 space-x-6 items-center">
              <div className="flex items-center space-x-2 bg-slate-800 px-3 py-1 rounded-full">
                 <Droplet className="w-3 h-3 text-emerald-400"/>
                 <span className="text-slate-200">{config.fuelPrice/1000}k GNF/L</span>
              </div>
              <span className="hidden lg:inline">{config.revenuePerTon/1000}k GNF/Ton</span>
            </div>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
              title="Settings"
            >
              <Settings className="w-6 h-6" />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-8">
        
        {showSettings && (
          <SettingsModal 
            config={config} 
            onSave={handleUpdateSettings} 
            onClose={() => setShowSettings(false)} 
          />
        )}

        {/* Dashboard Stats */}
        {!showForm && !showExpenseForm && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard 
              title="Net Profit" 
              value={formatCurrency(stats.totalProfit)} 
              icon={TrendingUp} 
              colorClass="text-emerald-600 bg-emerald-600"
            />
            <StatCard 
              title="Total Tons" 
              value={`${stats.totalTons.toFixed(1)} T`} 
              subtext={`${stats.totalTrips} Trips`}
              icon={Package} 
              colorClass="text-blue-600 bg-blue-600"
            />
            <StatCard 
              title="Revenue" 
              value={formatCurrency(stats.totalRevenue)} 
              icon={DollarSign} 
              colorClass="text-purple-600 bg-purple-600"
            />
            <StatCard 
              title="Total Expenses" 
              value={formatCurrency(stats.totalExpenses)} 
              icon={DollarSign} 
              colorClass="text-red-500 bg-red-500"
            />
          </div>
        )}

        {/* Action Bar */}
        {!showForm && !showExpenseForm && (
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-bold text-slate-800">Operations</h2>
              
              {/* View Toggle */}
              <div className="bg-slate-200 p-1 rounded-lg flex space-x-1">
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setViewMode('analytics')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'analytics' ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Analytics View"
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row w-full md:w-auto space-y-3 md:space-y-0 md:space-x-3">
              {viewMode === 'list' && (
                <div className="relative flex-1 md:w-64">
                  <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Filter by Truck ID..." 
                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={filterTruck}
                    onChange={(e) => setFilterTruck(e.target.value)}
                  />
                </div>
              )}
              <div className="flex space-x-2">
                <button 
                  onClick={() => setShowExpenseForm(true)}
                  className="flex-1 bg-slate-700 hover:bg-slate-800 text-white font-medium py-2 px-4 rounded-lg shadow flex items-center justify-center transition-colors"
                >
                  <Wallet className="w-5 h-5 mr-1" /> Add Expense
                </button>
                <button 
                  onClick={() => setShowForm(true)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg shadow flex items-center justify-center transition-colors"
                >
                  <Plus className="w-5 h-5 mr-1" /> Add Trip
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        {showForm ? (
          <TripForm 
            config={config}
            onSave={handleAddTrip} 
            onCancel={() => setShowForm(false)} 
          />
        ) : showExpenseForm ? (
          <ExpenseForm 
            onSave={handleAddExpense}
            onCancel={() => setShowExpenseForm(false)}
          />
        ) : viewMode === 'analytics' ? (
          <AnalyticsDashboard trips={trips} />
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Truck</th>
                    <th className="p-4">Details</th>
                    <th className="p-4 text-right">Cargo</th>
                    <th className="p-4 text-right">Expenses</th>
                    <th className="p-4 text-right">Revenue</th>
                    <th className="p-4 text-right">Net Profit</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTrips.map((trip) => {
                    const isExpense = trip.type === 'expense';
                    return (
                      <tr key={trip.id} className={`transition-colors ${isExpense ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'}`}>
                        <td className="p-4 text-slate-600 text-sm whitespace-nowrap">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                            {formatDate(trip.date)}
                          </div>
                        </td>
                        <td className="p-4 font-medium text-slate-800">{trip.truckNumber}</td>
                        <td className="p-4 text-slate-600">
                          {isExpense ? (
                            <div className="flex items-center text-red-600 font-medium">
                              <Wrench className="w-3 h-3 mr-1" /> {trip.category}
                              {trip.description && <span className="ml-2 text-xs font-normal text-slate-500">({trip.description})</span>}
                            </div>
                          ) : (
                            trip.destination ? (
                              <div className="flex items-center">
                                <MapPin className="w-3 h-3 mr-1 text-slate-400" />
                                {trip.destination}
                              </div>
                            ) : <span className="text-slate-400 italic">-</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {isExpense ? (
                            <span className="text-slate-300">-</span>
                          ) : (
                            <>
                              <div className="font-medium text-slate-800">{trip.bags} Bags</div>
                              <div className="text-xs text-slate-500">{trip.weightTons.toFixed(1)} Tons</div>
                            </>
                          )}
                        </td>
                        <td className="p-4 text-right text-red-500 font-medium">
                          {formatCurrency(trip.totalExpenses)}
                          {!isExpense && <div className="text-xs text-slate-400 font-normal">{trip.fuelLiters}L Fuel</div>}
                        </td>
                        <td className="p-4 text-right text-slate-600">
                          {isExpense ? <span className="text-slate-300">-</span> : formatCurrency(trip.revenue)}
                        </td>
                        <td className="p-4 text-right">
                          <span className={`py-1 px-3 rounded-full text-xs font-bold ${isExpense ? 'bg-red-200 text-red-800' : 'bg-emerald-100 text-emerald-700'}`}>
                            {formatCurrency(trip.netProfit)}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => handleDeleteTrip(trip.id)}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTrips.length === 0 && (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-400">
                        {user ? "Aucune donnée trouvée. Commencez par ajouter un trajet !" : "Chargement des données..."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}