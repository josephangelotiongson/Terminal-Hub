import React, { useState, useEffect } from 'react';
import { Operation, ScadaData, SOFItem } from '../types';
import { SOF_EVENTS_MODALITY, VESSEL_COMMODITY_EVENTS } from '../constants';

const useScada = (activeOp: Operation | undefined, setOperations: React.Dispatch<React.SetStateAction<Operation[]>>) => {
    const [scadaData, setScadaData] = useState<ScadaData>({});

    useEffect(() => {
        if (!activeOp) {
             setScadaData({});
             return;
        }

        const intervalId = setInterval(() => {
            const newScadaData: ScadaData = {};
            const linesToSimulate: { [key: string]: boolean } = {};
            
            const startPumpEventName = activeOp.modality === 'vessel' ? 'START PUMPING' : 'Pumping Started';
            const stopPumpEventName = activeOp.modality === 'vessel' ? 'STOP PUMPING' : 'Pumping Stopped';

            // Determine which lines are actively pumping
            (activeOp.transferPlan || []).forEach(line => {
                linesToSimulate[line.infrastructureId] = (line.transfers || []).some(t =>
                    (t.sof || []).some(s => s.event.includes(startPumpEventName) && s.status === 'complete') &&
                    !(t.sof || []).some(s => s.event.includes(stopPumpEventName) && s.status === 'complete')
                );
            });

            // Update scada data and transferred tonnes
            setOperations(prevOps => {
                const newOps = [...prevOps];
                const opIndex = newOps.findIndex(o => o.id === activeOp.id);
                if (opIndex === -1) return prevOps;

                const currentOp = { ...newOps[opIndex] };
                currentOp.transferPlan = currentOp.transferPlan.map(line => {
                    const isPumping = linesToSimulate[line.infrastructureId];
                    const flowRate = isPumping ? (line.infrastructureId.startsWith('L') ? 1200 : line.infrastructureId.startsWith('Bay') ? 150 : 300) + (Math.random() * 50 - 25) : 0;
                    const temperature = isPumping ? 45 + (Math.random() * 5 - 2.5) : 20;
                    const pressure = isPumping ? 5.5 + (Math.random() * 1 - 0.5) : 0;

                    newScadaData[line.infrastructureId] = { flowRate, pumpStatus: isPumping ? 'ON' : 'OFF', temperature, pressure };

                    if (isPumping) {
                        const activeTransfersOnLine = line.transfers.filter(t => 
                            ((t.tonnes || 0) - (t.transferredTonnes || 0) > 0) &&
                            (t.sof || []).some(s => s.event.includes(startPumpEventName) && s.status === 'complete') &&
                            !(t.sof || []).some(s => s.event.includes(stopPumpEventName) && s.status === 'complete')
                        ).length;

                        const flowPerTransfer = activeTransfersOnLine > 0 ? flowRate / activeTransfersOnLine : 0;
                        const increment = (flowPerTransfer * 1.5) / 3600; // 1.5s interval

                        line.transfers = line.transfers.map(t => {
                            if (((t.tonnes || 0) - (t.transferredTonnes || 0) > 0) &&
                                (t.sof || []).some(s => s.event.includes(startPumpEventName) && s.status === 'complete') &&
                                !(t.sof || []).some(s => s.event.includes(stopPumpEventName) && s.status === 'complete')) {
                                
                                const newTransferred = (t.transferredTonnes || 0) + increment;
                                if (newTransferred >= t.tonnes) {
                                    t.transferredTonnes = t.tonnes;
                                    const sofByLoop: Record<number, SOFItem[]> = (t.sof || []).reduce((acc: Record<number, SOFItem[]>, s: SOFItem) => {
                                        (acc[s.loop] = acc[s.loop] || []).push(s);
                                        return acc;
                                    }, {});

                                    let loopToStop: number | null = null;
                                    for (const loopNum of Object.keys(sofByLoop).map(Number).sort((a, b) => b - a)) {
                                        const loopEvents = sofByLoop[loopNum];
                                        const hasStarted = loopEvents.some(s => s.event.includes(startPumpEventName) && s.status === 'complete');
                                        const hasStopped = loopEvents.some(s => s.event.includes(stopPumpEventName));
                                        if (hasStarted && !hasStopped) {
                                            loopToStop = loopNum;
                                            break;
                                        }
                                    }

                                    if (loopToStop !== null) {
                                        const eventNameToStop = activeOp.modality === 'vessel' ? 'STOP PUMPING' : 'Pumping Stopped';
                                        const finalEventName = loopToStop > 1 ? `Rework #${loopToStop}: ${eventNameToStop}` : eventNameToStop;
                                        
                                        const stopItemIndex = (t.sof || []).findIndex(s => s.event === finalEventName && s.loop === loopToStop);
                                        if (stopItemIndex === -1) { // Prevent adding duplicate stop events
                                            t.sof = [...(t.sof || []), { event: finalEventName, status: 'complete', time: new Date().toISOString(), user: 'AUTO', loop: loopToStop }];
                                        }
                                    }
                                } else {
                                    t.transferredTonnes = newTransferred;
                                }
                            }
                            return t;
                        });
                    }
                    return line;
                });
                newOps[opIndex] = currentOp;
                return newOps;
            });
            
            setScadaData(newScadaData);

        }, 1500);

        return () => clearInterval(intervalId);

    }, [activeOp, setOperations]);

    return { scadaData };
};

export default useScada;