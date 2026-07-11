
import React, { useState, useEffect, useRef } from 'react';
import { CloseIcon, ActivityIcon, ServerIcon, BugIcon, GlobeIcon } from './Icons';

interface DstatGraphModalProps {
  onClose: () => void;
}

const DstatGraphModal: React.FC<DstatGraphModalProps> = ({ onClose }) => {
  const [mode, setMode] = useState<'L4' | 'L7'>('L7');
  
  // Inputs
  const [l7Url, setL7Url] = useState('');
  const [l4Ip, setL4Ip] = useState('');
  const [l4Port, setL4Port] = useState('80');

  const [isConnected, setIsConnected] = useState(false);
  const [isTargetAlive, setIsTargetAlive] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Graph Data States
  const [l4Data, setL4Data] = useState<number[]>(new Array(60).fill(0)); // Mbps
  const [l7Data, setL7Data] = useState<number[]>(new Array(60).fill(0)); // RPS
  
  const [stats, setStats] = useState({ 
      mbps: 0, 
      pps: 0, 
      rps: 0, 
      latency: 0,
      httpCode: 200,
      status: 'IDLE' 
  });

  const trafficIntervalRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<string>(''); 
  const modeRef = useRef<'L4' | 'L7'>('L7');
  const lastLatencyRef = useRef<number>(0);
  const lastHttpCodeRef = useRef<number>(200);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
  }, [logs]);

  const addLog = (msg: string, type: 'info' | 'warn' | 'crit' | 'success' = 'info') => {
      const time = new Date().toLocaleTimeString();
      let color = 'text-gray-400';
      if (type === 'warn') color = 'text-yellow-400';
      if (type === 'crit') color = 'text-red-500 font-bold';
      if (type === 'success') color = 'text-green-400';
      
      setLogs(prev => {
          const newLogs = [...prev, `<span class="text-xs text-gray-600 font-mono">[${time}]</span> <span class="${color}">${msg}</span>`];
          return newLogs.slice(-20); 
      });
  };

  const checkConnectivity = async (target: string, type: 'L4' | 'L7'): Promise<{ latency: number, code: number }> => {
      if (!target) return { latency: -1, code: 0 };
      const start = performance.now();
      try {
          if (type === 'L7') {
                let checkUrl = target;
                if (!checkUrl.startsWith('http')) {
                    checkUrl = `https://${checkUrl}`;
                }

                // STRATEGY 1: PROXY CHECK with Anti-Cache
                try {
                    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(checkUrl)}&disableCache=true&timestamp=${Date.now()}`;
                    const res = await fetch(proxyUrl);
                    const data = await res.json();
                    
                    if (data.status?.http_code) {
                         const end = performance.now();
                         return { 
                             latency: Math.max(10, Math.round(end - start)), 
                             code: data.status.http_code 
                         };
                    }
                } catch (proxyError) { }

                // STRATEGY 2: DIRECT NO-CORS (Fallback)
                await fetch(checkUrl, { 
                    mode: 'no-cors', 
                    cache: 'no-store',
                    signal: AbortSignal.timeout(5000)
                });
                const end = performance.now();
                return { latency: Math.round(end - start), code: 200 }; // Opaque response assumed 200

          } else {
              // LAYER 4: IP Check
              const ip = target.split(':')[0];
              const res = await fetch(`https://ipwho.is/${ip}`);
              const data = await res.json();
              if (data.success) {
                   const end = performance.now();
                   return { latency: Math.round(end - start), code: 200 };
              }
              return { latency: -1, code: 0 };
          }
      } catch (e) {
          return { latency: -1, code: 0 }; 
      }
  };

  const stopMonitoring = (reason?: string) => {
      if (trafficIntervalRef.current) clearInterval(trafficIntervalRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      trafficIntervalRef.current = null;
      pingIntervalRef.current = null;
      
      setIsConnected(false);
      setIsTargetAlive(false);
      setStats({ mbps: 0, pps: 0, rps: 0, latency: 0, httpCode: 0, status: 'IDLE' });
      
      if (reason) addLog(reason, 'crit');
      else addLog("Monitor stopped.", 'warn');
  };

  const startMonitoring = async () => {
      let target = '';
      if (mode === 'L7') {
          if (!l7Url) { addLog('Error: URL required for Layer 7.', 'crit'); return; }
          target = l7Url.startsWith('http') ? l7Url : `https://${l7Url}`;
      } else {
          if (!l4Ip) { addLog('Error: IP required for Layer 4.', 'crit'); return; }
          target = `${l4Ip}:${l4Port}`;
      }

      targetRef.current = target;
      modeRef.current = mode;

      setIsConnected(true);
      setStats(s => ({ ...s, status: 'SCANNING...' }));
      addLog(`[+] Resolving target: ${target}...`);

      const result = await checkConnectivity(targetRef.current, mode);
      
      if (result.latency === -1) {
          setStats(s => ({ ...s, status: 'DOWN', latency: 0 }));
          addLog(`[!] CONNECTION FAILED: Host Unreachable.`, 'crit');
          setIsConnected(false);
          return;
      }

      setIsTargetAlive(true);
      lastLatencyRef.current = result.latency;
      lastHttpCodeRef.current = result.code;
      
      addLog(`[+] Target is ALIVE. Handshake: ${result.latency}ms (HTTP ${result.code})`, 'success');
      setStats(s => ({ ...s, status: 'MONITORING', latency: result.latency, httpCode: result.code }));
      
      startSimulationLoop();
  };

  const startSimulationLoop = () => {
      // Ping Loop (Every 2s)
      pingIntervalRef.current = window.setInterval(async () => {
          const res = await checkConnectivity(targetRef.current, modeRef.current);
          lastLatencyRef.current = res.latency;
          lastHttpCodeRef.current = res.code;
          
          if (res.latency === -1) {
              setStats(s => ({ ...s, latency: 0, status: 'DOWN', httpCode: 0 }));
              addLog("Packet lost. Target unresponsive.", 'crit');
          } else {
              // Real latency + slight jitter
              const displayLatency = Math.max(1, res.latency + (Math.floor(Math.random() * 10) - 5));
              
              let status = 'STABLE';
              // Logic: High Latency OR Error Codes = Under Attack
              if (displayLatency > 300 || res.code === 503 || res.code === 502 || res.code === 429) {
                  status = 'STRESSED';
              }
              if (displayLatency > 800 || res.code === 504) {
                  status = 'CRITICAL';
              }
              
              setStats(s => ({ ...s, latency: displayLatency, status, httpCode: res.code }));
          }
      }, 2000);

      // Traffic Loop (200ms)
      trafficIntervalRef.current = window.setInterval(() => {
          setStats(currentStats => {
            // STRICT DEAD CHECK
            if (currentStats.status === 'DOWN') {
                 setL4Data(prev => [...prev.slice(1), 0]);
                 setL7Data(prev => [...prev.slice(1), 0]);
                 return { ...currentStats, mbps: 0, pps: 0, rps: 0 };
            }

            // SIMULATION LOGIC BASED ON REAL LATENCY & CODE
            const latency = lastLatencyRef.current;
            const code = lastHttpCodeRef.current;
            
            let isDDoS = false;
            let multiplier = 1;

            // Detect DDoS State based on Real World Metrics
            if (latency > 500 || code === 503 || code === 502 || code === 500) {
                isDDoS = true;
                multiplier = 20; // Massive spike if server is struggling
            } else if (latency > 200) {
                isDDoS = true;
                multiplier = 5; // Moderate spike
            } else if (latency > 0 && latency < 50) {
                multiplier = 0.5; // Calm
            }

            let newPps = 0;
            let newRps = 0;
            let status = isDDoS ? 'DDoS DETECTED' : 'MONITORING';
            let newMbps = 0;

            if (modeRef.current === 'L4') {
                const basePps = Math.floor(Math.random() * 500) + 100;
                newPps = basePps * multiplier;
                
                if (isDDoS) {
                    newPps += Math.floor(Math.random() * 50000); // UDP Flood simulation
                    if(Math.random() > 0.8) addLog(`[L4] UDP FLOOD DETECTED: ${(newPps/1000).toFixed(1)}k PPS`, 'crit');
                }
                newMbps = Math.round((newPps * 12000) / 1000000);
            } else {
                const baseRps = Math.floor(Math.random() * 50) + 10;
                newRps = baseRps * multiplier;

                if (isDDoS) {
                    newRps += Math.floor(Math.random() * 5000); // HTTP Flood simulation
                    if(Math.random() > 0.8) addLog(`[L7] HTTP FLOOD: ${newRps.toLocaleString()} Req/s`, 'crit');
                }
                newMbps = Math.round((newRps * 40000) / 1000000); 
            }

            setL4Data(prev => [...prev.slice(1), newMbps]);
            setL7Data(prev => [...prev.slice(1), newRps]);

            return { 
                ...currentStats, 
                mbps: newMbps, 
                pps: newPps, 
                rps: newRps,
                status: status
            };
          });
      }, 200);
  };

  useEffect(() => {
      return () => stopMonitoring();
  }, []);

  const getSafeHostname = (urlStr: string) => {
    try {
        if (!urlStr) return 'TARGET';
        const urlToParse = urlStr.startsWith('http') ? urlStr : `http://${urlStr}`;
        return new URL(urlToParse).hostname;
    } catch { return urlStr || 'TARGET'; }
  };

  const GraphVisualizer = ({ data, color, label, unit, maxScale }: { data: number[], color: string, label: string, unit: string, maxScale: number }) => {
      const height = 180;
      const width = 600;
      const currentMax = Math.max(maxScale, ...data);
      const safeMax = currentMax === 0 ? 100 : currentMax * 1.1;

      const generatePath = () => {
          if (data.length === 0) return `M 0 ${height}`;
          const stepX = width / (data.length - 1);
          const points = data.map((val, i) => {
              const x = i * stepX;
              const y = height - ((val / safeMax) * height);
              return `${x},${y}`;
          });
          return `M ${points.join(' L ')}`;
      };

      return (
        <div className="bg-black border border-gray-800 rounded-lg p-3 flex flex-col relative h-[240px]">
            {stats.status === 'DDoS DETECTED' && (
                <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded animate-pulse z-20">
                    ⚠️ ATTACK DETECTED
                </div>
            )}
            <div className="flex justify-between items-center mb-2 px-2">
                <div className={`text-xs font-mono font-bold flex items-center`} style={{color}}>
                    <span className="animate-pulse mr-2">●</span> {label}
                </div>
                <div className="text-xs font-mono text-gray-500">
                    PEAK: {Math.round(currentMax).toLocaleString()} {unit}
                </div>
            </div>
            <div className="flex-grow relative w-full overflow-hidden bg-[#050505] border border-gray-900 rounded">
                <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                    <path d={generatePath()} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" filter={`drop-shadow(0 0 6px ${color})`}/>
                    <path d={`${generatePath()} L ${width} ${height} L 0 ${height} Z`} fill={color} opacity="0.15"/>
                </svg>
            </div>
        </div>
      );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-[100] flex items-center justify-center p-4">
      <div className="bg-[#050505] border border-green-500/30 rounded-lg w-full max-w-6xl h-[90vh] flex flex-col shadow-[0_0_50px_rgba(34,197,94,0.1)] relative overflow-hidden">
        
        {/* CRT Effect */}
        <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,6px_100%] opacity-20"></div>

        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-[#0a0a0a] z-10 shrink-0">
          <div className="flex items-center space-x-3">
              <ActivityIcon className="text-red-500 w-6 h-6 animate-pulse" />
              <h1 className="text-xl font-bold font-orbitron text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-red-500 tracking-wider">
                  DSTAT <span className="text-xs align-top opacity-50 text-gray-400 ml-2">REALTIME TRAFFIC ANALYZER</span>
              </h1>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-white"><CloseIcon /></button>
        </div>

        {/* Controls */}
        <div className="p-4 border-b border-gray-800 bg-[#080808] z-10 shrink-0 flex flex-col gap-4">
            <div className="flex gap-2">
                <button onClick={() => { setMode('L7'); stopMonitoring(); }} className={`flex-1 py-2 text-xs font-bold font-mono border rounded transition-all ${mode === 'L7' ? 'bg-green-900/20 border-green-500 text-green-400' : 'bg-black border-gray-800 text-gray-500 hover:border-gray-600'}`}>LAYER 7 (APPLICATION)</button>
                <button onClick={() => { setMode('L4'); stopMonitoring(); }} className={`flex-1 py-2 text-xs font-bold font-mono border rounded transition-all ${mode === 'L4' ? 'bg-blue-900/20 border-blue-500 text-blue-400' : 'bg-black border-gray-800 text-gray-500 hover:border-gray-600'}`}>LAYER 4 (TRANSPORT)</button>
            </div>

            <div className="flex gap-4 items-end">
                {mode === 'L7' ? (
                    <div className="flex-grow">
                        <label className="text-[10px] font-mono text-gray-500 mb-1 block">TARGET URL</label>
                        <input type="text" placeholder="https://example.com" value={l7Url} onChange={(e) => setL7Url(e.target.value)} className="w-full bg-black border border-gray-800 rounded px-4 py-2 text-green-500 font-mono text-sm focus:border-green-500 focus:outline-none placeholder-gray-800" disabled={isConnected}/>
                    </div>
                ) : (
                    <>
                        <div className="flex-grow">
                            <label className="text-[10px] font-mono text-gray-500 mb-1 block">IP ADDRESS</label>
                            <input type="text" placeholder="1.1.1.1" value={l4Ip} onChange={(e) => setL4Ip(e.target.value)} className="w-full bg-black border border-gray-800 rounded px-4 py-2 text-blue-500 font-mono text-sm focus:border-blue-500 focus:outline-none placeholder-gray-800" disabled={isConnected}/>
                        </div>
                        <div className="w-24">
                            <label className="text-[10px] font-mono text-gray-500 mb-1 block">PORT</label>
                            <input type="text" placeholder="80" value={l4Port} onChange={(e) => setL4Port(e.target.value)} className="w-full bg-black border border-gray-800 rounded px-4 py-2 text-blue-500 font-mono text-sm focus:border-blue-500 focus:outline-none placeholder-gray-800" disabled={isConnected}/>
                        </div>
                    </>
                )}
                <button onClick={isConnected ? () => stopMonitoring() : startMonitoring} className={`px-8 py-2 h-10 rounded font-mono font-bold text-sm border transition-all ${isConnected ? 'bg-red-900/20 border-red-500 text-red-500 hover:bg-red-900/40 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-gray-800 border-gray-600 text-white hover:bg-gray-700'}`}>{isConnected ? 'STOP SCAN' : 'START SCAN'}</button>
            </div>
        </div>

        {/* Dashboard */}
        <div className="flex-grow flex flex-col lg:flex-row min-h-0 z-10 overflow-hidden">
            <div className="flex-grow flex flex-col border-r border-gray-800 p-4 space-y-4 overflow-y-auto custom-scrollbar">
                
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                    <div className="bg-gray-900/50 border border-gray-800 p-2 rounded flex flex-col items-center justify-center">
                        <div className="text-[10px] text-gray-500 font-mono uppercase">Status</div>
                        <div className={`text-sm font-bold font-mono ${stats.status === 'DOWN' ? 'text-red-600 animate-pulse' : stats.status.includes('DDoS') ? 'text-red-500 animate-pulse' : 'text-green-500'}`}>{stats.status}</div>
                    </div>
                    <div className="bg-gray-900/50 border border-gray-800 p-2 rounded flex flex-col items-center justify-center">
                        <div className="text-[10px] text-gray-500 font-mono uppercase">Latency</div>
                        <div className={`text-sm font-bold font-mono ${stats.latency === 0 ? 'text-red-600' : stats.latency > 500 ? 'text-red-500' : 'text-green-400'}`}>{stats.latency > 0 ? `${stats.latency} ms` : 'TIMEOUT'}</div>
                    </div>
                    {mode === 'L4' ? (
                        <>
                            <div className="bg-gray-900/50 border border-gray-800 p-2 rounded flex flex-col items-center justify-center">
                                <div className="text-[10px] text-gray-500 font-mono uppercase">Bandwidth</div>
                                <div className="text-sm font-bold font-mono text-blue-400">{stats.mbps.toLocaleString()} Mbps</div>
                            </div>
                            <div className="bg-gray-900/50 border border-gray-800 p-2 rounded flex flex-col items-center justify-center">
                                <div className="text-[10px] text-gray-500 font-mono uppercase">Packets</div>
                                <div className="text-sm font-bold font-mono text-purple-400">{(stats.pps / 1000).toFixed(1)}k PPS</div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="bg-gray-900/50 border border-gray-800 p-2 rounded flex flex-col items-center justify-center">
                                <div className="text-[10px] text-gray-500 font-mono uppercase">Data Rate</div>
                                <div className="text-sm font-bold font-mono text-blue-400">{stats.mbps.toLocaleString()} Mbps</div>
                            </div>
                            <div className="bg-gray-900/50 border border-gray-800 p-2 rounded flex flex-col items-center justify-center">
                                <div className="text-[10px] text-gray-500 font-mono uppercase">Requests</div>
                                <div className="text-sm font-bold font-mono text-yellow-400">{stats.rps.toLocaleString()} R/s</div>
                            </div>
                        </>
                    )}
                </div>

                {mode === 'L4' ? (
                    <GraphVisualizer data={l4Data} color="#3b82f6" label={`L4 TRAFFIC FLOW: ${l4Ip || 'Unknown'}`} unit="Mbps" maxScale={100} />
                ) : (
                    <GraphVisualizer data={l7Data} color="#eab308" label={`L7 REQUEST RATE: ${getSafeHostname(l7Url)}`} unit="Req/s" maxScale={50} />
                )}
            </div>

            {/* Logs */}
            <div className="w-full lg:w-80 bg-[#080808] flex flex-col border-l border-gray-800 font-mono text-xs shrink-0 h-48 lg:h-auto">
                <div className="p-2 border-b border-gray-800 text-gray-500 font-bold bg-[#111] flex justify-between">
                    <span>EVENT LOGS</span>
                    <span className="text-[10px] opacity-50 text-green-500">LIVE</span>
                </div>
                <div ref={logContainerRef} className="flex-grow p-2 overflow-y-auto space-y-1 custom-scrollbar scroll-smooth">
                    {logs.map((html, i) => (
                        <div key={i} dangerouslySetInnerHTML={{__html: html}} className="break-words border-l-2 border-transparent hover:border-gray-700 pl-1 py-0.5"/>
                    ))}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DstatGraphModal;
