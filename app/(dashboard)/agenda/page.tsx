"use client";

import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Loader2, Plus, ExternalLink, Settings, Check } from "lucide-react";
import MobileFAB from "@/components/MobileFAB";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CalendarEvent {
    id: string;
    summary: string;
    description?: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
    htmlLink: string;
    calendarId?: string; // composite "intId:calId"
}

interface CalendarListEntry {
    id: string;
    summary: string;
    backgroundColor?: string;
    primary?: boolean;
    integrationId?: string;
    accountEmail?: string;
}

export default function AgendaPage() {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [calendars, setCalendars] = useState<CalendarListEntry[]>([]);
    const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
    const [showCalendarSettings, setShowCalendarSettings] = useState(false);

    const [isLoading, setIsLoading] = useState(true);
    const [isConnected, setIsConnected] = useState(false);

    // Create Event Modal State
    const [isCreating, setIsCreating] = useState(false);
    const [newEvent, setNewEvent] = useState({ title: "", description: "", date: "", startTime: "", endTime: "", selectedCalendarId: "" });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        // Initial fetch
        const init = async () => {
            await fetchCalendars();
        };
        init();
    }, []);

    // Fetch events whenever selected calendars change
    useEffect(() => {
        if (selectedCalendarIds.length > 0) {
            fetchEvents();
        } else if (isConnected && !isLoading && selectedCalendarIds.length === 0) {
            // If connected but no calendar selected, clear events
            setEvents([]);
        }
    }, [selectedCalendarIds, isConnected]);

    const fetchCalendars = async () => {
        try {
            const res = await fetch("/api/calendar/list");
            if (res.status === 404) {
                setIsConnected(false);
                setIsLoading(false);
                return;
            }

            const data = await res.json();
            if (data.calendars) {
                setCalendars(data.calendars);
                setIsConnected(true);

                // Default logic: Select all PRIMARY calendars from all accounts
                // Construct composite IDs: "integrationId:calendarId"
                const primaryIds = data.calendars
                    .filter((c: any) => c.primary)
                    .map((c: any) => `${c.integrationId}:${c.id}`);

                if (selectedCalendarIds.length === 0) {
                    if (primaryIds.length > 0) {
                        setSelectedCalendarIds(primaryIds);
                    } else if (data.calendars.length > 0) {
                        // Fallback to absolute first one available
                        const first = data.calendars[0];
                        setSelectedCalendarIds([`${first.integrationId}:${first.id}`]);
                    }
                }
            }
        } catch (error) {
            console.error("Failed to fetch calendars", error);
            setIsLoading(false);
        }
    };

    const fetchEvents = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedCalendarIds.length > 0) {
                params.append('calendarIds', selectedCalendarIds.join(','));
            } else {
                // Nothing selected
                setIsLoading(false);
                return;
            }

            const res = await fetch(`/api/calendar/events?${params.toString()}`);

            if (res.status === 404) {
                setIsConnected(false);
            } else {
                const data = await res.json();
                setIsConnected(true);
                if (data.events) setEvents(data.events);
            }
        } catch (error) {
            console.error("Failed to fetch agenda", error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleCalendar = (cal: CalendarListEntry) => {
        const compositeId = `${cal.integrationId}:${cal.id}`;
        setSelectedCalendarIds(prev => {
            if (prev.includes(compositeId)) {
                return prev.filter(id => id !== compositeId);
            } else {
                return [...prev, compositeId];
            }
        });
    };

    const handleConnect = () => {
        window.location.href = "/api/auth/google";
    };

    const handleCreateEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const startDateTime = `${newEvent.date}T${newEvent.startTime}:00`;
            const endDateTime = `${newEvent.date}T${newEvent.endTime}:00`;

            // Parse composite ID
            let integrationId = undefined;
            let calendarId = undefined;

            if (newEvent.selectedCalendarId) {
                const parts = newEvent.selectedCalendarId.split(':');
                if (parts.length >= 2) {
                    integrationId = parts[0];
                    calendarId = parts.slice(1).join(':');
                }
            }

            const res = await fetch("/api/calendar/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: newEvent.title,
                    description: newEvent.description,
                    start: startDateTime,
                    end: endDateTime,
                    integrationId,
                    calendarId
                })
            });

            if (res.ok) {
                setIsCreating(false);
                setNewEvent({ title: "", description: "", date: "", startTime: "", endTime: "", selectedCalendarId: "" });
                fetchEvents(); // Refresh list
            } else {
                alert("Erro ao criar evento");
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao criar evento");
        } finally {
            setIsSaving(false);
        }
    };

    // Helper to find default calendar ID
    const getDefaultCalendarId = () => {
        if (calendars.length > 0) {
            const primary = calendars.find(c => c.primary);
            if (primary) return `${primary.integrationId}:${primary.id}`;
            return `${calendars[0].integrationId}:${calendars[0].id}`;
        }
        return "";
    };

    return (
        <div className="max-w-7xl mx-auto py-8 relative px-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Minha Agenda</h1>
                    <p className="text-muted-foreground">Seus compromissos do Google Calendar em um só lugar.</p>
                </div>

                <div className="hidden md:flex items-center gap-3">
                    {isConnected && (
                        <button
                            onClick={() => setShowCalendarSettings(!showCalendarSettings)}
                            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all border ${showCalendarSettings ? 'bg-muted border-primary/50 text-primary' : 'bg-card hover:bg-muted border-border'}`}
                        >
                            <Settings size={18} />
                            Agendas
                        </button>
                    )}
                    {isConnected ? (
                        <button
                            onClick={() => {
                                const today = new Date().toISOString().split('T')[0];

                                // Find a default calendar (Primary or First)
                                let defaultCalId = "";
                                if (calendars.length > 0) {
                                    const primary = calendars.find(c => c.primary);
                                    if (primary) defaultCalId = `${primary.integrationId}:${primary.id}`;
                                    else defaultCalId = `${calendars[0].integrationId}:${calendars[0].id}`;
                                }

                                setNewEvent(prev => ({
                                    ...prev,
                                    date: today,
                                    selectedCalendarId: defaultCalId
                                }));
                                setIsCreating(true);
                            }}
                            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-primary/20 transition-all"
                        >
                            <Plus size={20} />
                            Novo Evento
                        </button>
                    ) : (
                        <button
                            onClick={handleConnect}
                            className="bg-white text-slate-900 border border-slate-200 hover:bg-gray-50 px-4 py-2 rounded-lg font-bold shadow-sm flex items-center gap-2 transition-all"
                        >
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                            Conectar
                        </button>
                    )}
                </div>

                <MobileFAB
                    actions={isConnected ? [
                        {
                            label: "Novo Evento",
                            icon: <Plus size={20} />,
                            onClick: () => {
                                const today = new Date().toISOString().split('T')[0];
                                let defaultCalId = "";
                                if (calendars.length > 0) {
                                    const primary = calendars.find(c => c.primary);
                                    if (primary) defaultCalId = `${primary.integrationId}:${primary.id}`;
                                    else defaultCalId = `${calendars[0].integrationId}:${calendars[0].id}`;
                                }
                                setNewEvent(prev => ({ ...prev, date: today, selectedCalendarId: defaultCalId }));
                                setIsCreating(true);
                            },
                            color: "bg-primary"
                        },
                        {
                            label: "Agendas",
                            icon: <Settings size={20} />,
                            onClick: () => setShowCalendarSettings(!showCalendarSettings),
                            color: "bg-gray-700"
                        }
                    ] : undefined}
                    mainAction={!isConnected ? {
                        label: "Conectar",
                        icon: <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />,
                        onClick: handleConnect,
                        color: "bg-white"
                    } : undefined}
                />
            </div>

            {/* Calendar Selection Panel */}
            {isConnected && showCalendarSettings && (
                <div className="mb-8 p-6 bg-card border border-border rounded-xl shadow-sm animate-in fade-in slide-in-from-top-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-lg">Exibir Agendas</h3>
                        <button onClick={handleConnect} className="text-xs flex items-center gap-1 text-primary hover:underline font-medium">
                            <Plus size={12} /> Adicionar outra conta Google
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {calendars.map(cal => {
                            const compositeId = `${cal.integrationId}:${cal.id}`;
                            const isSelected = selectedCalendarIds.includes(compositeId);

                            return (
                                <div
                                    key={compositeId}
                                    onClick={() => toggleCalendar(cal)}
                                    className={`
                                        cursor-pointer p-3 rounded-lg border flex items-center gap-3 transition-all select-none
                                        ${isSelected
                                            ? 'bg-primary/10 border-primary/50'
                                            : 'bg-muted/30 border-transparent hover:bg-muted/50'}
                                    `}
                                >
                                    <div
                                        className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${isSelected ? 'scale-100' : 'scale-90 opacity-50'}`}
                                        style={{ backgroundColor: cal.backgroundColor || '#3b82f6' }}
                                    >
                                        {isSelected && <Check size={10} className="text-white" />}
                                    </div>
                                    <div className="flex flex-col overflow-hidden">
                                        <span className={`truncate ${isSelected ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                                            {cal.summary}
                                        </span>
                                        {cal.accountEmail && (
                                            <span className="text-[10px] text-muted-foreground/70 truncate">
                                                {cal.accountEmail}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {isLoading && events.length === 0 ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin text-muted-foreground" size={40} />
                </div>
            ) : !isConnected ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 bg-card border border-border rounded-2xl p-12 shadow-sm">
                    <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center">
                        <CalendarIcon size={40} className="text-blue-500" />
                    </div>
                    <div className="max-w-md space-y-2">
                        <h2 className="text-2xl font-bold">Conectar Google Calendar</h2>
                        <p className="text-muted-foreground">
                            Sincronize sua agenda para visualizar seus próximos compromissos diretamente aqui.
                        </p>
                    </div>
                    <button
                        onClick={handleConnect}
                        className="bg-white text-slate-900 hover:bg-gray-100 px-8 py-3 rounded-full font-bold shadow-lg flex items-center gap-3 transition-all"
                    >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
                        Conectar com Google
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {events.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
                            <CalendarIcon className="mx-auto mb-3 opacity-20" size={48} />
                            <p className="text-lg font-medium">Nenhum evento encontrado</p>
                            <p className="text-sm">Verifique se as agendas corretas estão selecionadas.</p>
                        </div>
                    ) : (
                        events.map((event) => {
                            const startDate = event.start.dateTime ? new Date(event.start.dateTime) : (event.start.date ? new Date(event.start.date) : new Date());
                            // const endDate = event.end.dateTime ? new Date(event.end.dateTime) : (event.end.date ? new Date(event.end.date) : new Date());
                            const isAllDay = !event.start.dateTime;

                            // Find calendar color
                            const calendar = calendars.find(c => `${c.integrationId}:${c.id}` === event.calendarId);
                            const calColor = calendar?.backgroundColor || '#3b82f6';
                            const eventAccountEmail = calendar?.accountEmail;
                            const eventCalSummary = calendar?.summary;

                            return (
                                <div key={event.id} className="bg-card border border-border p-6 rounded-xl hover:shadow-lg transition-all group relative overflow-hidden flex flex-col h-full">
                                    <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: calColor }} />

                                    <div className="flex justify-between items-start mb-4 pl-3">
                                        <div className="px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider"
                                            style={{ backgroundColor: `${calColor}20`, color: calColor }}>
                                            {isAllDay ? "Dia Inteiro" : format(startDate, "HH:mm")}
                                        </div>
                                        <div className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
                                            {format(startDate, "dd 'de' MMM", { locale: ptBR })}
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-bold mb-2 pl-3 line-clamp-2" title={event.summary}>
                                        {event.summary}
                                    </h3>

                                    {event.description && (
                                        <p className="text-muted-foreground text-sm mb-4 pl-3 line-clamp-3 flex-1">
                                            {event.description}
                                        </p>
                                    )}

                                    <div className="mt-auto pl-3 pt-3 border-t border-border/50 flex flex-col gap-1">
                                        <div className="flex justify-between items-center">
                                            {eventCalSummary && (
                                                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider opacity-70">
                                                    {eventCalSummary}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex justify-between items-center">
                                            {eventAccountEmail && (
                                                <span className="text-[10px] text-muted-foreground/50 truncate max-w-[150px]" title={eventAccountEmail}>
                                                    {eventAccountEmail}
                                                </span>
                                            )}
                                            <a
                                                href={event.htmlLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm font-medium hover:underline flex items-center gap-1 group-hover:text-primary transition-colors ml-auto"
                                            >
                                                Ver no Google <ExternalLink size={12} />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Modal Create Event */}
            {isCreating && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <h2 className="text-2xl font-bold mb-6">Novo Evento</h2>
                        <form onSubmit={handleCreateEvent} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Título</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    placeholder="Reunião de Projeto"
                                    value={newEvent.title}
                                    onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Salvar na Agenda</label>
                                <select
                                    required
                                    className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2 outline-none"
                                    value={newEvent.selectedCalendarId}
                                    onChange={e => setNewEvent({ ...newEvent, selectedCalendarId: e.target.value })}
                                >
                                    {calendars
                                        .filter(cal => selectedCalendarIds.includes(`${cal.integrationId}:${cal.id}`))
                                        .map(cal => (
                                            <option
                                                key={`${cal.integrationId}:${cal.id}`}
                                                value={`${cal.integrationId}:${cal.id}`}
                                                className="text-slate-900" /* Force dark text for visibility in default dropdowns */
                                            >
                                                {cal.summary} {cal.accountEmail ? `(${cal.accountEmail})` : ''}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Data</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2 outline-none"
                                        value={newEvent.date}
                                        onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Horário (Início)</label>
                                    <input
                                        type="time"
                                        required
                                        className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2 outline-none"
                                        value={newEvent.startTime}
                                        onChange={e => setNewEvent({ ...newEvent, startTime: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Horário (Fim)</label>
                                <input
                                    type="time"
                                    required
                                    className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2 outline-none"
                                    value={newEvent.endTime}
                                    onChange={e => setNewEvent({ ...newEvent, endTime: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Descrição</label>
                                <textarea
                                    className="w-full bg-muted/50 border border-border rounded-lg px-4 py-2 outline-none min-h-[100px]"
                                    placeholder="Detalhes do evento..."
                                    value={newEvent.description}
                                    onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsCreating(false)}
                                    className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors font-medium"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : "Salvar no Google"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
