
import React, { useState, useEffect, useRef } from 'react';
import { CloseIcon, GlobeIcon, SendIcon, SpinnerIcon, ExternalLinkIcon } from './Icons';

interface WebsiteScraperModalProps {
  onClose: () => void;
  onSendToAI: (text: string) => void;
}

const WebsiteScraperModal: React.FC<WebsiteScraperModalProps> = ({ onClose, onSendToAI }) => {
  const [url, setUrl] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [scrapedData, setScrapedData] = useState<any>(null);
  const [interactableElements, setInteractableElements] = useState<{text: string, href: string}[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Helper to add colored logs to the "terminal"
  const log = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
      const timestamp = new Date().toLocaleTimeString();
      let colorClass = 'text-gray-300';
      if (type === 'success') colorClass = 'text-green-400';
      if (type === 'error') colorClass = 'text-red-400';
      if (type === 'warning') colorClass = 'text-yellow-400';
      
      setLogs(prev => [...prev, `<span class="text-gray-500">[${timestamp}]</span> <span class="${colorClass}">${message}</span>`]);
  };

  useEffect(() => {
      if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const fetchWithProxy = async (targetUrl: string) => {
      // Use 'get' endpoint to receive JSON with status info
      // We use encodeURIComponent to handle special characters in URL
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`Proxy Error: ${response.status}`);
      return response.json();
  };

  const analyzeTarget = async (targetUrl: string) => {
    if (!targetUrl) return;
    // Normalize URL
    if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;

    setIsLoading(true);
    setLogs([]);
    setInteractableElements([]);
    setScrapedData(null);
    
    log(`[i] Initiating full target reconnaissance on: ${targetUrl}...`, 'info');

    const targetDetails: any = {
        url: targetUrl,
        status_code: "N/A",
        server: "Unknown (Masked)",
        content_type: "text/html",
        content_length: "N/A",
        behind_cloudflare: "N/A",
        ip_address: "N/A",
        location: "N/A",
        isp: "N/A",
        org: "N/A",
        asn: "N/A",
        title: "N/A",
        links_found: 0
    };

    try {
        // Step 1: HTTP Analysis via Proxy
        log(`[~] Sending HTTP request...`, 'info');
        const startTime = Date.now();
        
        // AllOrigins returns { contents: string, status: { url, content_type, http_code, response_time } }
        let data;
        try {
            data = await fetchWithProxy(targetUrl);
        } catch (e) {
            log(`[!] Primary proxy failed, attempting direct fetch (CORS might block)...`, 'warning');
            // Fallback (rarely works for arbitrary sites due to CORS, but worth a shot for some)
            try {
                const res = await fetch(targetUrl, { mode: 'no-cors' });
                data = { contents: "", status: { http_code: res.status || 0, content_type: "unknown" } };
                log(`[!] Opaque response received. Detailed stats limited.`, 'warning');
            } catch (err) {
                 throw new Error("Target unreachable via all methods.");
            }
        }

        const endTime = Date.now();
        
        targetDetails.status_code = data.status?.http_code || 200;
        targetDetails.latency = `${endTime - startTime}ms`;
        targetDetails.content_type = data.status?.content_type || "text/html";
        
        log(`[+] HTTP Status: ${targetDetails.status_code}`, targetDetails.status_code >= 200 && targetDetails.status_code < 400 ? 'success' : 'warning');
        
        const text = data.contents; // The actual HTML string
        
        if (text) {
            targetDetails.content_length = text.length;
            log(`[+] Content Length: ${text.length} bytes`, 'info');

            // Check for Cloudflare signatures
            if (text.includes('cf-ray') || text.includes('cloudflare')) {
                 targetDetails.behind_cloudflare = "Yes (Detected)";
                 log(`[!] Cloudflare Detected!`, 'warning');
            } else {
                 targetDetails.behind_cloudflare = "No";
            }

            // Step 2: DOM Parsing
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            targetDetails.title = doc.title || "No Title";
            log(`[+] Page Title: ${targetDetails.title}`, 'success');

            // Extract Links
            const domainOrigin = new URL(targetUrl).origin;
            const links = Array.from(doc.querySelectorAll('a')).map(a => {
                let href = a.getAttribute('href') || '';
                if (href.startsWith('/')) href = domainOrigin + href;
                return {
                    text: a.innerText.trim() || href,
                    href: href
                };
            }).filter(l => l.text && l.href.startsWith('http'));
            
            const uniqueLinks = Array.from(new Map(links.map(item => [item.href, item])).values());
            setInteractableElements(uniqueLinks.slice(0, 30));
            targetDetails.links_found = uniqueLinks.length;
            log(`[+] Found ${uniqueLinks.length} interactable links.`, 'info');
        } else {
            log(`[!] No HTML content returned (CORS/Blocking).`, 'warning');
        }

        // Step 3: DNS & IP Analysis
        try {
            const domain = new URL(targetUrl).hostname;
            log(`[~] Resolving DNS for ${domain}...`, 'info');
            
            // Google DNS over HTTPS
            const dnsRes = await fetch(`https://dns.google/resolve?name=${domain}`);
            const dnsData = await dnsRes.json();
            
            if (dnsData.Answer) {
                const ipRecord = dnsData.Answer.find((a: any) => a.type === 1); // Type 1 = A Record
                
                if (ipRecord) {
                    targetDetails.ip_address = ipRecord.data;
                    log(`[+] Resolved IP: ${targetDetails.ip_address}`, 'success');

                    // Step 4: Advanced IP Info via ip-api.com (As requested)
                    // We use AllOrigins proxy because ip-api.com is HTTP and will be blocked by Mixed Content on HTTPS sites
                    log(`[~] Fetching detailed IP intelligence via ip-api.com...`, 'info');
                    
                    try {
                        const ipApiUrl = `http://ip-api.com/json/${targetDetails.ip_address}?fields=status,message,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,query`;
                        const proxyRes = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(ipApiUrl)}`);
                        const proxyJson = await proxyRes.json();
                        const ipData = JSON.parse(proxyJson.contents);

                        if (ipData.status === 'success') {
                            targetDetails.isp = ipData.isp;
                            targetDetails.org = ipData.org;
                            targetDetails.asn = ipData.as;
                            targetDetails.location = `${ipData.city}, ${ipData.regionName}, ${ipData.country}`;
                            
                            log(`[+] ISP: ${targetDetails.isp}`, 'success');
                            log(`[+] Organization: ${targetDetails.org}`, 'success');
                            log(`[+] ASN: ${targetDetails.asn}`, 'info');
                            log(`[+] Location: ${targetDetails.location}`, 'success');
                        } else {
                            throw new Error(ipData.message || "IP API Failed");
                        }
                    } catch (ipErr) {
                         log(`[!] ip-api.com failed (${ipErr}), falling back to ipwho.is...`, 'warning');
                         // Fallback
                         const geoRes = await fetch(`https://ipwho.is/${targetDetails.ip_address}`);
                         const geoData = await geoRes.json();
                         if (geoData.success) {
                            targetDetails.isp = geoData.connection.isp;
                            targetDetails.location = `${geoData.city}, ${geoData.country}`;
                            targetDetails.asn = `AS${geoData.connection.asn}`;
                            log(`[+] ISP (Fallback): ${targetDetails.isp}`, 'success');
                         }
                    }

                } else {
                    log(`[!] No A Record found in DNS.`, 'warning');
                }
            } else {
                log(`[!] DNS Resolution failed.`, 'warning');
            }
        } catch (err) {
            log(`[!] DNS/IP Analysis failed: ${err}`, 'error');
        }
        
        setScrapedData(targetDetails);

    } catch (error) {
        log(`[!] Critical Error: ${error instanceof Error ? error.message : 'Connection Failed'}`, 'error');
    } finally {
        setIsLoading(false);
        log(`[i] Reconnaissance complete.`, 'info');
    }
  };

  const handleSendReport = () => {
      if (!scrapedData) return;
      
      const report = `
**WormGPT Reconnaissance Report**
Target: ${scrapedData.url}

**Network Intelligence:**
- **IP Address:** ${scrapedData.ip_address}
- **ISP:** ${scrapedData.isp}
- **Organization:** ${scrapedData.org}
- **ASN:** ${scrapedData.asn}
- **Location:** ${scrapedData.location}
- **Cloudflare Protected:** ${scrapedData.behind_cloudflare}

**HTTP Analysis:**
- **Status:** ${scrapedData.status_code}
- **Content Type:** ${scrapedData.content_type}
- **Latency:** ${scrapedData.latency}
- **Content Length:** ${scrapedData.content_length} bytes

**Content Analysis:**
- **Page Title:** ${scrapedData.title}
- **Interactable Links:** ${scrapedData.links_found} found

**Instructions:**
Please analyze this target data. Guide me on how to use this site, bypass any detected protections, or customize my settings to interact with it efficiently.
`;
      onSendToAI(report);
      onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f0f11] border border-green-500/30 rounded-lg shadow-[0_0_30px_rgba(34,197,94,0.1)] w-full max-w-4xl h-[85vh] flex flex-col font-mono">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-[#131314]">
          <div className="flex items-center space-x-2">
              <GlobeIcon className="text-green-500 w-5 h-5" />
              <h2 className="text-lg font-bold text-green-500">WormGPT Advanced Scraper v2.2</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><CloseIcon /></button>
        </div>

        {/* Input Bar */}
        <div className="p-4 border-b border-gray-800 flex gap-2">
            <input 
                type="text" 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter Target URL (e.g. example.com)"
                className="flex-grow bg-black border border-gray-700 rounded px-4 py-2 text-green-400 focus:outline-none focus:border-green-500 placeholder-gray-700"
                onKeyDown={(e) => e.key === 'Enter' && analyzeTarget(url)}
            />
            <button 
                onClick={() => analyzeTarget(url)}
                disabled={isLoading}
                className="px-4 py-2 bg-green-900/30 text-green-400 border border-green-500/50 rounded hover:bg-green-900/50 disabled:opacity-50"
            >
                {isLoading ? <SpinnerIcon /> : 'INFILTRATE'}
            </button>
        </div>

        {/* Main Terminal Output */}
        <div className="flex-grow flex min-h-0">
            {/* Terminal Log */}
            <div className="flex-grow bg-black p-4 overflow-y-auto custom-scrollbar border-r border-gray-800">
                <div className="text-xs text-gray-600 mb-2">System Output:</div>
                {logs.length === 0 && <div className="text-gray-700 italic">Ready to scan...</div>}
                {logs.map((html, i) => (
                    <div key={i} className="mb-1 text-sm font-mono break-all" dangerouslySetInnerHTML={{__html: html}} />
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Sidebar: Interactions */}
            <div className="w-1/3 bg-[#131314] flex flex-col border-l border-gray-800">
                <div className="p-2 bg-gray-900 text-xs font-bold text-gray-400 border-b border-gray-800 uppercase">Target Interactions</div>
                
                <div className="flex-grow overflow-y-auto p-2 space-y-2 custom-scrollbar">
                    {interactableElements.length > 0 ? (
                        interactableElements.map((link, i) => (
                            <button 
                                key={i}
                                onClick={() => { setUrl(link.href); analyzeTarget(link.href); }}
                                className="w-full text-left p-2 rounded border border-gray-800 bg-black hover:border-green-500/50 hover:bg-green-900/10 group transition-all"
                            >
                                <div className="text-xs text-green-400 truncate group-hover:text-green-300">{link.text}</div>
                                <div className="text-[10px] text-gray-600 truncate">{link.href}</div>
                            </button>
                        ))
                    ) : (
                        <div className="p-4 text-center text-gray-600 text-xs">
                            No interactable elements extracted yet.
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-800">
                    <button 
                        onClick={handleSendReport}
                        disabled={!scrapedData}
                        className="w-full py-3 bg-purple-900/20 border border-purple-500/50 text-purple-400 rounded hover:bg-purple-900/40 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <SendIcon className="w-4 h-4" />
                        <span>Send Findings to AI</span>
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default WebsiteScraperModal;
