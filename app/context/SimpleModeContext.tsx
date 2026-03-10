"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface SimpleModeContextType {
    isSimpleMode: boolean;
    toggleSimpleMode: () => void;
}

const SimpleModeContext = createContext<SimpleModeContextType | undefined>(undefined);

export function SimpleModeProvider({ children }: { children: React.ReactNode }) {
    const [isSimpleMode, setIsSimpleMode] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // Load preference from localStorage on mount
        const storedPreference = localStorage.getItem("taskfreela_simple_mode");
        if (storedPreference !== null) {
            setIsSimpleMode(storedPreference === "true");
        }
        setIsLoaded(true);
    }, []);

    const toggleSimpleMode = () => {
        setIsSimpleMode(prev => {
            const newValue = !prev;
            localStorage.setItem("taskfreela_simple_mode", String(newValue));
            return newValue;
        });
    };

    // Prevent hydration mismatch by not rendering children until localStorage is checked
    if (!isLoaded) {
        return <div className="min-h-screen bg-background flex flex-col items-center justify-center pointer-events-none opacity-0 transition-opacity duration-300"></div>; // Or a subtle loader
    }

    return (
        <SimpleModeContext.Provider value={{ isSimpleMode, toggleSimpleMode }}>
            {children}
        </SimpleModeContext.Provider>
    );
}

export function useSimpleMode() {
    const context = useContext(SimpleModeContext);
    if (context === undefined) {
        throw new Error("useSimpleMode must be used within a SimpleModeProvider");
    }
    return context;
}
