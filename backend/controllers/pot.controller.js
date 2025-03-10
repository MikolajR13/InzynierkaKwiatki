import Pot from '../models/Pot.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { sendPotListToUser, requestSoilMoistureCheck } from '../mqttClient.js';

// Pobierz wszystkie doniczki dla konkretnego użytkownika
export const getPotsByUser = async (req, res) => {
    const userId = req.user.id; // Pobierz userId z authMiddleware

    try {
        const pots = await Pot.find({ owner: userId });
        res.status(200).json({ success: true, data: pots });
    } catch (error) {
        console.error("Błąd pobierania doniczek", error.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const requestSoilMoisture = async (req, res) => {
    const userId = req.user.id;
    const { potId } = req.params;
  
    try {
      const pot = await Pot.findOne({ _id: potId, owner: userId });
      if (!pot) {
        return res.status(404).json({ success: false, message: 'Doniczka nie została znaleziona' });
      }
  
      requestSoilMoistureCheck(userId, potId);
      res.status(200).json({ success: true, message: 'Wysłano żądanie o sprawdzenie wilgotności gleby' });
    } catch (error) {
      console.error("Błąd podczas wysyłania żądania o wilgotność gleby", error.message);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };

export const getLatestSoilMoisture = async (req, res) => {
    const userId = req.user.id; 
    const { potId } = req.params;

    try {
        const pot = await Pot.findOne({ _id: potId, owner: userId });
        if (!pot) {
            return res.status(404).json({ success: false, message: 'Doniczka nie została znaleziona' });
        }

        const latestEntry = pot.wateringHistory
            .filter(entry => entry.soilMoisture != null)
            .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

        if (!latestEntry) {
            return res.status(404).json({ success: false, message: 'Brak danych o wilgotności gleby' });
        }

        res.status(200).json({ success: true, soilMoisture: latestEntry.soilMoisture });
    } catch (error) {
        console.error("Błąd podczas pobierania najnowszej wilgotności gleby", error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Pobieranie konkretnej doniczki użytkownika
export const getPotById = async (req, res) => {
    const userId = req.user.id; // Pobierz userId z authMiddleware
    const { potId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(potId)) {
        return res.status(404).json({ success: false, message: "Nie ma doniczki o takim Id" });
    }

    try {
        const pot = await Pot.findOne({ _id: potId, owner: userId });
        if (!pot) {
            return res.status(404).json({ success: false, message: "Doniczka nie znaleziona" });
        }
        res.status(200).json({ success: true, data: pot });
    } catch (error) {
        console.error("Błąd pobierania doniczki", error.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// Utwórz nową doniczkę dla konkretnego użytkownika
export const addPot = async (req, res) => {
    const {
        potName,
        flowerName,
        waterAmount,
        wateringFrequency,
        potSize,
        shape,
        dimensions,
        otherParams,
    } = req.body;

    if (
        !potName ||
        !flowerName ||
        !waterAmount ||
        !wateringFrequency ||
        !potSize ||
        !shape ||
        !dimensions.height ||
        (shape === 'Prostopadłościan' && (!dimensions.width || !dimensions.depth)) ||
        (shape === 'Walec' && !dimensions.diameter)
    ) {
        return res.status(400).json({
            success: false,
            message: "Proszę wypełnić wszystkie wymagane pola.",
        });
    }

    try {
        const newPot = new Pot({
            potName,
            flowerName,
            waterAmount,
            wateringFrequency,
            potSize,
            shape,
            dimensions,
            otherParams,
            owner: req.user.id,
        });
        const userId = req.user.id;

        await newPot.save();

        await User.findByIdAndUpdate(req.user.id, {
            $push: { pots: newPot._id }
        });

        res.status(201).json({ success: true, data: newPot });
        sendPotListToUser(userId);
    } catch (error) {
        console.error("Błąd dodawania doniczki:", error.message);
        res.status(500).json({ success: false, message: "Błąd serwera podczas dodawania doniczki." });
    }
};

// Aktualizacja doniczki użytkownika
export const updatePot = async (req, res) => {
    const userId = req.user.id;; // Pobierz userId z authMiddleware
    const { potId } = req.params;
    const potData = req.body;

    if (!mongoose.Types.ObjectId.isValid(potId)) {
        return res.status(404).json({ success: false, message: "Nie ma doniczki o takim Id" });
    }

    try {
        const updatedPot = await Pot.findOneAndUpdate(
            { _id: potId, owner: userId },
            potData,
            { new: true }
        );
        if (!updatedPot) return res.status(404).json({ success: false, message: "Doniczka nie znaleziona" });
        res.status(200).json({ success: true, data: updatedPot });
    } catch (error) {
        console.error("Błąd aktualizacji doniczki", error.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// Usuwanie doniczki użytkownika
export const deletePot = async (req, res) => {
    const userId = req.user.id; // Pobierz userId z authMiddleware
    const { potId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(potId)) {
        return res.status(404).json({ success: false, message: "Nie ma doniczki o takim Id" });
    }

    try {
        const deletedPot = await Pot.findOneAndDelete({ _id: potId, owner: userId });
        if (!deletedPot) {
            return res.status(404).json({ success: false, message: "Doniczka nie znaleziona" });
        }

        await User.findByIdAndUpdate(userId, {
            $pull: { pots: potId }
        });

        res.status(200).json({ success: true, message: `Doniczka o id: ${potId} usunięta` });
        sendPotListToUser(userId);
    } catch (error) {
        console.error("Nie można usunąć doniczki", error.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
