/**
 * AFS Loader Script v2.2 - FIXED Duplicate Div Issue
 * Supports both AdSense and Google Ad Exchange
 */
(function(w, d) {
    'use strict';
    
    const AFS = {
        init: function(config) {
            if (!config || !config.p || !config.s || !config.c) {
                console.warn('AFS: Invalid configuration');
                return;
            }
            
            this.config = config;
            this.retryCount = 0;
            this.maxRetries = 5;
            this.retryDelay = 300;
            this.checkDelay = 3000;
            this.gptLoaded = false;
            
            // Preload GPT for AdX if needed
            if (config.at === 'adx') {
                this.preloadGPT();
            }
            
            w.addEventListener('DOMContentLoaded', () => {
                this.loadCsa();
            });
        },
        
        preloadGPT: function() {
            if (w.googletag || this.gptLoaded) return;
            
            const gptScript = d.createElement('script');
            gptScript.async = true;
            gptScript.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';
            gptScript.onload = () => {
                this.gptLoaded = true;
                w.googletag = w.googletag || { cmd: [] };
            };
            d.head.appendChild(gptScript);
        },
        
        loadCsa: function() {
            const opts = {
                pubId: this.config.p,
                styleId: this.config.s,
                channel: this.config.c,
                resultsPageBaseUrl: this.buildUrl(),
                resultsPageQueryParam: 's',
                relatedSearchTargeting: 'content',
                adsafe: 'low',
                terms: this.config.t || 'default',
                referrerAdCreative: this.config.r || 'Related content'
            };
            
            const block1 = {
                container: 'rfsbox1',
                relatedSearches: this.config.n || 5
            };
            
            const block2 = {
                container: 'rfsbox2',
                relatedSearches: this.config.n || 5
            };
            
            this.initWithRetry(opts, block1, block2);
        },
        
        initWithRetry: function(opts, b1, b2) {
            if (typeof w._googCsa === 'function') {
                w._googCsa('relatedsearch', opts, b1, b2);
                setTimeout(() => this.checkAd(), this.checkDelay);
            } else if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                setTimeout(() => this.initWithRetry(opts, b1, b2), this.retryDelay);
            } else {
                this.loadFallback();
            }
        },
        
        checkAd: function() {
            const box = d.getElementById('rfsbox1');
            if (!box) {
                this.loadFallback();
                return;
            }
            
            const iframe = box.querySelector('iframe');
            if (!iframe || iframe.offsetHeight === 0) {
                this.loadFallback();
            }
        },
        
        loadFallback: function() {
            if (!this.config.fb || this.config.fb !== '1') {
                return;
            }
            
            if (this.shouldBlock()) {
                return;
            }
            
            const box = d.getElementById('rfsbox1');
            if (!box) return;
            
            box.innerHTML = '';
            
            // Choose ad network based on type
            if (this.config.at === 'adx') {
                this.loadAdX(box);
            } else {
                this.loadAdSense(box);
            }
        },
        
        loadAdSense: function(container) {
            // Create AdSense ad unit
            const ins = d.createElement('ins');
            ins.className = 'adsbygoogle';
            ins.style.display = 'block';
            ins.setAttribute('data-ad-client', this.config.pc);
            ins.setAttribute('data-ad-slot', this.config.sl);
            ins.setAttribute('data-ad-format', 'auto');
            ins.setAttribute('data-full-width-responsive', 'true');
            
            const script = d.createElement('script');
            script.innerHTML = '(adsbygoogle = window.adsbygoogle || []).push({});';
            
            container.appendChild(ins);
            container.appendChild(script);
            
            console.log('AFS: Loaded AdSense fallback');
        },
        
        // ✅ FIXED: Use existing container instead of creating new div
        loadAdX: function(container) {
            // Use existing container ID (e.g., rfsbox1) instead of creating new div
            let divId = container.id;
            
            // If container has no ID, assign a fixed one
            if (!divId) {
                divId = 'afs-adx-slot';
                container.id = divId;
            }
            
            // Set styles directly on existing container
            container.style.minHeight = '250px';
            container.style.textAlign = 'center';
            
            // Ensure GPT is loaded
            if (!w.googletag && !this.gptLoaded) {
                this.preloadGPT();
                setTimeout(() => this.initAdX(divId), 1000);
            } else {
                this.initAdX(divId);
            }
        },
        
        // ✅ FIXED: Check for duplicate slots before defining
        initAdX: function(divId) {
            w.googletag = w.googletag || { cmd: [] };
            
            w.googletag.cmd.push(() => {
                const adUnit = this.config.sl; // e.g., "/12345/site/ad-unit"
                
                // ✅ CHECK: Prevent duplicate slot definition
                const existingSlots = w.googletag.pubads().getSlots();
                const existingSlot = existingSlots.find(s => 
                    s.getSlotElementId() === divId
                );
                
                if (existingSlot) {
                    console.log('AFS: Reusing existing AdX slot for', divId);
                    // Just display the existing slot
                    w.googletag.display(divId);
                    return;
                }
                
                // Determine ad sizes based on viewport
                const sizes = this.getResponsiveSizes();
                
                // Define new slot
                const slot = w.googletag.defineSlot(adUnit, sizes, divId);
                
                if (slot) {
                    slot.addService(w.googletag.pubads());
                    
                    // Set targeting parameters
                    if (this.config.t) {
                        slot.setTargeting('topics', this.config.t.split(','));
                    }
                    
                    if (this.config.c) {
                        slot.setTargeting('campaign', this.config.c);
                    }
                    
                    // ✅ FIXED: Only enable services once
                    if (!w.googletag.pubadsReady) {
                        w.googletag.pubads().enableSingleRequest();
                        w.googletag.pubads().collapseEmptyDivs();
                        w.googletag.pubads().setCentering(true);
                        
                        // Privacy settings
                        w.googletag.pubads().setPrivacySettings({
                            restrictDataProcessing: false
                        });
                        
                        w.googletag.enableServices();
                        w.googletag.pubadsReady = true; // Custom flag to prevent re-enabling
                    }
                    
                    // Display ad
                    w.googletag.display(divId);
                    
                    console.log('AFS: Loaded AdX fallback', adUnit, 'in div', divId);
                } else {
                    console.error('AFS: Failed to define AdX slot for', adUnit);
                }
            });
        },
        
        getResponsiveSizes: function() {
            const width = w.innerWidth;
            
            // Mobile
            if (width < 768) {
                return [
                    [320, 50],
                    [320, 100],
                    [300, 250]
                ];
            }
            
            // Tablet
            if (width < 1024) {
                return [
                    [728, 90],
                    [468, 60],
                    [300, 250],
                    [336, 280]
                ];
            }
            
            // Desktop
            return [
                [970, 90],
                [970, 250],
                [728, 90],
                [300, 250],
                [336, 280],
                [160, 600]
            ];
        },
        
        shouldBlock: function() {
            // Anti-adblock detection
            if (w.canRunAds === false) return true;
            
            // Check for common adblockers
            const testAd = d.createElement('div');
            testAd.innerHTML = '&nbsp;';
            testAd.className = 'adsbox ad-placement ad-container';
            testAd.style.height = '1px';
            d.body.appendChild(testAd);
            
            const isBlocked = testAd.offsetHeight === 0;
            d.body.removeChild(testAd);
            
            return isBlocked;
        },
        
        buildUrl: function() {
            const base = this.config.u || w.location.origin;
            const params = [];
            
            if (this.config.f) params.push('fbid=' + this.config.f);
            if (this.config.c) params.push('campid=' + this.config.c);
            if (this.config.s) params.push('gads=' + this.config.s);
            
            return base + (params.length ? '?' + params.join('&') : '');
        }
    };
    
    // Facebook Pixel Loader
    const FB = {
        init: function(pixelId) {
            if (!pixelId) return;
            
            !function(f,b,e,v,n,t,s) {
                if(f.fbq) return;
                n=f.fbq=function(){
                    n.callMethod ? n.callMethod.apply(n,arguments) : n.queue.push(arguments)
                };
                if(!f._fbq) f._fbq=n;
                n.push=n; n.loaded=!0; n.version='2.0';
                n.queue=[];
                t=b.createElement(e); t.async=!0;
                t.src=v;
                s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)
            }(w, d, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
            
            w.fbq('init', pixelId);
            w.fbq('track', 'PageView');
        }
    };
    
    // Expose API
    w.AFS_Loader = {
        start: function(config) {
            AFS.init(config);
            if (config.f) {
                FB.init(config.f);
            }
        },
        
        // Manual trigger for AdX refresh
        refreshAdX: function() {
            if (w.googletag && w.googletag.pubads) {
                w.googletag.pubads().refresh();
            }
        },
        
        // Debug helper
        debugSlots: function() {
            if (!w.googletag) {
                console.log('GPT not loaded');
                return;
            }
            
            w.googletag.cmd.push(function() {
                const slots = w.googletag.pubads().getSlots();
                console.group('🔍 AdX Slots Debug');
                console.log('Total slots:', slots.length);
                
                slots.forEach((slot, idx) => {
                    console.log(`Slot ${idx + 1}:`, {
                        adUnit: slot.getAdUnitPath(),
                        divId: slot.getSlotElementId(),
                        sizes: slot.getSizes().map(s => s.width + 'x' + s.height)
                    });
                });
                
                console.groupEnd();
            });
        }
    };
    
})(window, document);
