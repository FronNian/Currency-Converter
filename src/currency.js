// ==UserScript==
// @name         全能货币转换器 - Universal Currency Converter
// @name:en      Universal Currency Converter
// @namespace    https://greasyfork.org/users/currency-converter
// @version      1.1.0
// @description  智能识别网页价格，鼠标悬停即可查看实时汇率转换。支持15+主流货币，使用免费API，数据缓存，性能优化。
// @description:en  Intelligently detect prices on web pages and view real-time currency conversions on hover. Supports 15+ major currencies with free APIs, data caching, and performance optimization.
// @author       FronNian
// @copyright    2025, FronNian (2081610040@qq.com)
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @connect      v6.exchangerate-api.com
// @connect      api.fixer.io
// @connect      api.currencyapi.com
// @license      GPL-3.0-or-later
// @icon         data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">💱</text></svg>
// @run-at       document-idle
// @homepage     https://greasyfork.org/scripts/currency-converter
// @supportURL   https://greasyfork.org/scripts/currency-converter/feedback
// ==/UserScript==

(function() {
  'use strict';

  /*
   * 全能货币转换器 - Universal Currency Converter
   * Copyright (C) 2025 FronNian (2081610040@qq.com)
   * 
   * This program is free software: you can redistribute it and/or modify
   * it under the terms of the GNU General Public License as published by
   * the Free Software Foundation, either version 3 of the License, or
   * (at your option) any later version.
   * 
   * This program is distributed in the hope that it will be useful,
   * but WITHOUT ANY WARRANTY; without even the implied warranty of
   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
   * GNU General Public License for more details.
   * 
   * 如果您修改了此代码，请：
   * 1. 保留原作者信息（FronNian - 2081610040@qq.com）
   * 2. 注明修改内容
   * 3. 使用相同的GPL-3.0许可证
   * 4. 建议通知原作者（邮箱或GreasyFork评论区）
   * 
   * 完整许可证: https://www.gnu.org/licenses/gpl-3.0.txt
   */

  // API密钥配置（用户提供）
  // ExchangeRate-API: 04529d4768099d362afffc31
  // Fixer.io: 147078d87fed12fc4266aa216b3c98c9
  // CurrencyAPI: cur_live_cqiOETlTuk2UvLSDONtdIxhTZIlq6PPElZ9wtxlv

  /* ==================== 默认配置 ==================== */
  
  /**
   * 默认配置对象
   * @type {Object}
   */
  const DEFAULT_CONFIG = {
    // 目标货币列表（最多3个）
    targetCurrencies: ['CNY', 'USD', 'EUR'],
    
    // API密钥配置
    apiKeys: {
      exchangeRateApi: '04529d4768099d362afffc31',
      fixer: '147078d87fed12fc4266aa216b3c98c9',
      currencyapi: 'cur_live_cqiOETlTuk2UvLSDONtdIxhTZIlq6PPElZ9wtxlv'
    },
    
    // 缓存配置
    cacheExpiry: 3600000, // 1小时（毫秒）
    
    // UI配置
    tooltipDelay: 300,       // 工具提示显示延迟（毫秒）
    tooltipTheme: 'gradient', // 工具提示主题：gradient | light | dark
    
    // 性能配置
    enableLazyLoad: true,    // 启用懒加载
    scanOnIdle: true,        // 在空闲时扫描
    
    // 识别配置
    minAmount: 0.01,         // 最小金额
    maxAmount: 999999999,    // 最大金额
    
    // 语言
    language: 'zh-CN'
  };

  /* ==================== 配置管理模块 ==================== */
  
  /**
   * 配置管理器类
   * 负责用户配置的加载、保存、获取和重置
   */
  class ConfigManager {
    constructor() {
      this.config = this.load();
    }

    /**
     * 从GM_storage加载配置
     * @returns {Object} 配置对象
     */
    load() {
      try {
        const saved = GM_getValue('cc_config');
        if (saved) {
          const parsedConfig = JSON.parse(saved);
          // 合并默认配置和已保存配置，确保向后兼容
          const mergedConfig = { ...DEFAULT_CONFIG, ...parsedConfig };
          
          // 检查是否使用了自定义API密钥
          if (parsedConfig.apiKeys) {
            const customKeys = [];
            if (parsedConfig.apiKeys.exchangeRateApi !== DEFAULT_CONFIG.apiKeys.exchangeRateApi) {
              customKeys.push('ExchangeRate-API');
            }
            if (parsedConfig.apiKeys.fixer !== DEFAULT_CONFIG.apiKeys.fixer) {
              customKeys.push('Fixer.io');
            }
            if (parsedConfig.apiKeys.currencyapi !== DEFAULT_CONFIG.apiKeys.currencyapi) {
              customKeys.push('CurrencyAPI');
            }
            
            if (customKeys.length > 0) {
              console.log(`[CC] 🔑 使用自定义API密钥: ${customKeys.join(', ')}`);
            } else {
              console.log('[CC] 使用默认API密钥');
            }
          }
          
          return mergedConfig;
        }
      } catch (error) {
        console.error('[CurrencyConverter] Failed to load config:', error);
      }
      // 返回默认配置的副本
      console.log('[CC] 使用默认配置');
      return { ...DEFAULT_CONFIG };
    }

    /**
     * 保存配置到GM_storage
     * @param {Object} newConfig - 新的配置对象（部分或完整）
     */
    save(newConfig) {
      try {
        // 合并现有配置和新配置
        this.config = { ...this.config, ...newConfig };
        GM_setValue('cc_config', JSON.stringify(this.config));
        
        // 显示保存的密钥信息
        if (newConfig.apiKeys) {
          const keys = [];
          if (newConfig.apiKeys.exchangeRateApi) {
            keys.push(`ExchangeRate-API: ${newConfig.apiKeys.exchangeRateApi.substring(0, 8)}****`);
          }
          if (newConfig.apiKeys.fixer) {
            keys.push(`Fixer: ${newConfig.apiKeys.fixer.substring(0, 8)}****`);
          }
          if (newConfig.apiKeys.currencyapi) {
            keys.push(`CurrencyAPI: ${newConfig.apiKeys.currencyapi.substring(0, 8)}****`);
          }
          console.log('[CC] ✅ API密钥已保存:', keys.join(', '));
        } else {
          console.log('[CC] 配置已保存');
        }
      } catch (error) {
        console.error('[CurrencyConverter] Failed to save config:', error);
      }
    }

    /**
     * 获取单个配置项
     * @param {string} key - 配置项的键
     * @returns {*} 配置项的值
     */
    get(key) {
      return this.config[key];
    }

    /**
     * 设置单个配置项
     * @param {string} key - 配置项的键
     * @param {*} value - 配置项的值
     */
    set(key, value) {
      this.config[key] = value;
      this.save(this.config);
    }

    /**
     * 重置为默认配置
     */
    reset() {
      try {
        this.config = { ...DEFAULT_CONFIG };
        GM_setValue('cc_config', JSON.stringify(this.config));
        console.log('[CurrencyConverter] Config reset to defaults');
      } catch (error) {
        console.error('[CurrencyConverter] Failed to reset config:', error);
      }
    }

    /**
     * 获取所有配置
     * @returns {Object} 完整的配置对象
     */
    getAll() {
      return { ...this.config };
    }
  }

  /* ==================== 工具函数库 ==================== */
  
  /**
   * 通用工具函数库
   * 提供防抖、节流、休眠等辅助功能
   */
  const Utils = {
    /**
     * 防抖函数 - 延迟执行，多次调用只执行最后一次
     * @param {Function} func - 要防抖的函数
     * @param {number} delay - 延迟时间（毫秒）
     * @returns {Function} 防抖后的函数
     * 
     * @example
     * const debouncedFn = Utils.debounce(() => console.log('Hello'), 300);
     * debouncedFn(); // 只有在300ms内没有再次调用时才会执行
     */
    debounce(func, delay) {
      let timer = null;
      return function(...args) {
        const context = this;
        clearTimeout(timer);
        timer = setTimeout(() => {
          func.apply(context, args);
        }, delay);
      };
    },

    /**
     * 节流函数 - 限制函数执行频率
     * @param {Function} func - 要节流的函数
     * @param {number} limit - 时间间隔（毫秒）
     * @returns {Function} 节流后的函数
     * 
     * @example
     * const throttledFn = Utils.throttle(() => console.log('Hello'), 300);
     * throttledFn(); // 在300ms内多次调用只执行一次
     */
    throttle(func, limit) {
      let inThrottle = false;
      return function(...args) {
        const context = this;
        if (!inThrottle) {
          func.apply(context, args);
          inThrottle = true;
          setTimeout(() => {
            inThrottle = false;
          }, limit);
        }
      };
    },

    /**
     * 异步休眠函数
     * @param {number} ms - 休眠时间（毫秒）
     * @returns {Promise} Promise对象
     * 
     * @example
     * await Utils.sleep(1000); // 休眠1秒
     */
    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * HTML转义函数 - 防止XSS攻击
     * @param {string} text - 要转义的文本
     * @returns {string} 转义后的文本
     * 
     * @example
     * Utils.escapeHTML('<script>alert("XSS")</script>');
     * // 返回: &lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;
     */
    escapeHTML(text) {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return String(text).replace(/[&<>"']/g, m => map[m]);
    },

    /**
     * 数字格式化函数
     * @param {number} num - 要格式化的数字
     * @param {number} decimals - 小数位数（默认2位）
     * @returns {string} 格式化后的数字字符串
     * 
     * @example
     * Utils.formatNumber(1234567.89); // 返回: "1,234,567.89"
     * Utils.formatNumber(1234.5, 0);  // 返回: "1,235"
     */
    formatNumber(num, decimals = 2) {
      if (isNaN(num)) return '0';
      
      const fixed = Number(num).toFixed(decimals);
      const parts = fixed.split('.');
      
      // 添加千分位分隔符
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      
      return parts.join('.');
    }
  };

  /* ==================== 汇率数据管理器 ==================== */
  
  /**
   * 汇率数据管理器类
   * 负责调用汇率API、缓存管理和货币转换计算
   */
  class ExchangeRateManager {
    constructor(configManager) {
      this.config = configManager;
      this.apis = [
        {
          name: 'exchangerate-api',
          url: 'https://v6.exchangerate-api.com/v6/{key}/latest/{base}',
          priority: 1,
          requiresKey: true,
          parseResponse: (data) => ({
            base: data.base_code,
            rates: data.conversion_rates,
            timestamp: Date.now(),
            source: 'exchangerate-api'
          })
        },
        {
          name: 'fixer',
          url: 'https://api.fixer.io/latest?access_key={key}&base={base}',
          priority: 2,
          requiresKey: true,
          parseResponse: (data) => ({
            base: data.base,
            rates: data.rates,
            timestamp: Date.now(),
            source: 'fixer'
          })
        },
        {
          name: 'currencyapi',
          url: 'https://api.currencyapi.com/v3/latest?apikey={key}&base_currency={base}',
          priority: 3,
          requiresKey: true,
          parseResponse: (data) => {
            const rates = {};
            if (data.data) {
              for (const [currency, info] of Object.entries(data.data)) {
                rates[currency] = info.value;
              }
            }
            return {
              base: data.meta?.last_updated_at ? 'USD' : 'USD',
              rates: rates,
              timestamp: Date.now(),
              source: 'currencyapi'
            };
          }
        }
      ];
      this.currentRates = null;
      this.updatePromise = null;
    }

    /**
     * 获取汇率数据（带缓存）
     * @param {string} baseCurrency - 基准货币代码（默认USD）
     * @returns {Promise<Object>} 汇率数据对象
     */
    async getRates(baseCurrency = 'USD') {
      // 检查缓存
      const cached = this.getFromCache(baseCurrency);
      if (cached && !this.isExpired(cached)) {
        this.currentRates = cached.ratesData;
        return cached.ratesData;
      }

      // 避免并发请求
      if (this.updatePromise) {
        return this.updatePromise;
      }

      this.updatePromise = this.fetchRates(baseCurrency);
      try {
        const rates = await this.updatePromise;
        this.saveToCache(baseCurrency, rates);
        this.currentRates = rates;
        return rates;
      } catch (error) {
        console.warn('[CC] API failed, trying cache:', error);
        // 降级到缓存（即使过期）
        if (cached) {
          console.log('[CC] Using expired cache as fallback');
          this.currentRates = cached.ratesData;
          return cached.ratesData;
        }
        throw error;
      } finally {
        this.updatePromise = null;
      }
    }

    /**
     * 从API获取汇率
     * @param {string} baseCurrency - 基准货币代码
     * @returns {Promise<Object>} 汇率数据对象
     */
    async fetchRates(baseCurrency) {
      // 按优先级尝试每个API
      for (const api of this.apis) {
        // 检查是否需要密钥
        if (api.requiresKey) {
          const keyName = api.name === 'exchangerate-api' ? 'exchangeRateApi' : api.name;
          const apiKey = this.config.get('apiKeys')[keyName];
          if (!apiKey) {
            console.warn(`[CC] No API key for ${api.name}, skipping`);
            continue;
          }
        }

        try {
          console.log(`[CC] Trying API: ${api.name}`);
          const data = await this.callAPI(api, baseCurrency);
          if (data && data.rates) {
            console.log(`[CC] Successfully got rates from ${api.name}`);
            return data;
          }
        } catch (error) {
          console.warn(`[CC] API ${api.name} failed:`, error.message);
          continue;
        }
      }

      throw new Error('All APIs failed');
    }

    /**
     * 调用单个API（带重试机制）
     * @param {Object} api - API配置对象
     * @param {string} baseCurrency - 基准货币代码
     * @param {number} retries - 重试次数（默认3次）
     * @returns {Promise<Object>} API响应数据
     */
    async callAPI(api, baseCurrency, retries = 3) {
      const keyName = api.name === 'exchangerate-api' ? 'exchangeRateApi' : api.name;
      const apiKey = this.config.get('apiKeys')[keyName] || '';
      
      // 显示正在使用的API密钥（部分遮盖）
      const maskedKey = apiKey ? `${apiKey.substring(0, 8)}****${apiKey.substring(apiKey.length - 4)}` : 'no-key';
      console.log(`[CC] 调用 ${api.name} API (密钥: ${maskedKey})`);
      
      const url = api.url
        .replace('{key}', apiKey)
        .replace('{base}', baseCurrency);

      for (let i = 0; i < retries; i++) {
        try {
          const response = await new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
              method: 'GET',
              url: url,
              timeout: 10000,
              onload: (resp) => {
                if (resp.status === 200) {
                  try {
                    const data = JSON.parse(resp.responseText);
                    resolve(data);
                  } catch (e) {
                    reject(new Error('Invalid JSON response'));
                  }
                } else {
                  reject(new Error(`HTTP ${resp.status}: ${resp.statusText}`));
                }
              },
              onerror: (resp) => {
                reject(new Error('Network error'));
              },
              ontimeout: () => {
                reject(new Error('Request timeout'));
              }
            });
          });

          // 使用API特定的解析函数
          return api.parseResponse(response);
        } catch (error) {
          if (i === retries - 1) {
            throw error;
          }
          // 指数退避
          const backoffTime = 1000 * (i + 1);
          console.log(`[CC] Retry ${i + 1}/${retries} after ${backoffTime}ms`);
          await Utils.sleep(backoffTime);
        }
      }
    }

    /**
     * 货币转换
     * @param {number} amount - 金额
     * @param {string} fromCurrency - 源货币代码
     * @param {string} toCurrency - 目标货币代码
     * @returns {number} 转换后的金额
     */
    convert(amount, fromCurrency, toCurrency) {
      if (!this.currentRates) {
        throw new Error('Rates not loaded');
      }

      if (fromCurrency === toCurrency) {
        return amount;
      }

      const base = this.currentRates.base;
      const rates = this.currentRates.rates;

      // 如果from是base货币
      if (fromCurrency === base) {
        return amount * (rates[toCurrency] || 1);
      }

      // 如果to是base货币
      if (toCurrency === base) {
        return amount / (rates[fromCurrency] || 1);
      }

      // 两者都不是base，需要中转
      const inBase = amount / (rates[fromCurrency] || 1);
      return inBase * (rates[toCurrency] || 1);
    }

    /**
     * 从缓存读取汇率数据
     * @param {string} baseCurrency - 基准货币代码
     * @returns {Object|null} 缓存数据或null
     */
    getFromCache(baseCurrency) {
      try {
        const key = `cc_rates_${baseCurrency}`;
        const cached = GM_getValue(key);
        return cached ? JSON.parse(cached) : null;
      } catch (error) {
        console.error('[CC] Failed to read cache:', error);
        return null;
      }
    }

    /**
     * 保存汇率数据到缓存
     * @param {string} baseCurrency - 基准货币代码
     * @param {Object} ratesData - 汇率数据对象
     */
    saveToCache(baseCurrency, ratesData) {
      try {
        const key = `cc_rates_${baseCurrency}`;
        const cacheExpiry = this.config.get('cacheExpiry') || 3600000;
        const cacheData = {
          ratesData,
          cachedAt: Date.now(),
          expiresAt: Date.now() + cacheExpiry
        };
        GM_setValue(key, JSON.stringify(cacheData));
        console.log(`[CC] Rates cached for ${baseCurrency}, expires in ${cacheExpiry / 1000}s`);
      } catch (error) {
        console.error('[CC] Failed to save cache:', error);
      }
    }

    /**
     * 检查缓存是否过期
     * @param {Object} cached - 缓存数据对象
     * @returns {boolean} 是否过期
     */
    isExpired(cached) {
      return Date.now() > cached.expiresAt;
    }
  }

  /* ==================== 货币识别引擎 ==================== */
  
  /**
   * 货币检测器类
   * 负责扫描网页、识别价格和货币符号、标记元素
   */
  class CurrencyDetector {
    constructor(configManager) {
      this.config = configManager;
      this.detectedElements = new WeakMap(); // 缓存已识别元素
      this.currencyPatterns = this.buildPatterns();
    }

    /**
     * 构建货币识别正则表达式模式
     * @returns {Array} 正则模式数组
     */
    buildPatterns() {
      return [
        {
          // 符号在前：$123.45, €1,234.56, US$ 4.99
          pattern: /([A-Z]{2,3})?[$¥€£₹₩]\s*([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{1,2})?)/g,
          currencyGroup: 1,
          amountGroup: 2,
          prefixSymbol: true
        },
        {
          // ISO代码 + 符号：US$ 123.45, HK$ 234.56
          pattern: /([A-Z]{2})\$\s*([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{1,2})?)/g,
          currencyGroup: 1,
          amountGroup: 2,
          withPrefix: true
        },
        {
          // ISO代码在前：USD 123.45, CNY 1234.56
          pattern: /\b([A-Z]{3})\s+([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{1,2})?)\b/g,
          currencyGroup: 1,
          amountGroup: 2
        },
        {
          // 数字在前：123.45 USD, 1234 CNY
          pattern: /\b([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{1,2})?)\s+([A-Z]{3})\b/g,
          amountGroup: 1,
          currencyGroup: 2
        },
        {
          // 欧洲格式（小数点用逗号）：€1.234,56
          pattern: /([€£])\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{1,2})?)/g,
          currencyGroup: 1,
          amountGroup: 2,
          europeanFormat: true
        }
      ];
    }

    /**
     * 扫描整个页面
     */
    scanPage() {
      const startTime = performance.now();
      
      // 方法1: 扫描文本节点（原有方法）
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            // 过滤script、style等标签
            const parent = node.parentElement;
            if (!parent || parent.matches('script, style, noscript, textarea, [contenteditable="true"]')) {
              return NodeFilter.FILTER_REJECT;
            }
            // 过滤已标记的元素
            if (parent.classList.contains('cc-price-detected') || parent.closest('.cc-tooltip')) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      let node;
      let count = 0;
      while (node = walker.nextNode()) {
        if (this.analyzeTextNode(node)) {
          count++;
        }
      }

      // 方法2: 扫描价格容器元素（处理分离的货币符号和数字）
      count += this.scanPriceContainers();

      const elapsed = performance.now() - startTime;
      console.log(`[CC] Page scan completed in ${elapsed.toFixed(2)}ms, found ${count} prices`);
    }

    /**
     * 扫描单个元素
     * @param {HTMLElement} element - 要扫描的元素
     */
    scanElement(element) {
      if (!element || element.nodeType !== Node.ELEMENT_NODE) return;

      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (!parent || parent.matches('script, style, noscript, textarea')) {
              return NodeFilter.FILTER_REJECT;
            }
            if (parent.classList.contains('cc-price-detected') || parent.closest('.cc-tooltip')) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      let node;
      while (node = walker.nextNode()) {
        this.analyzeTextNode(node);
      }
    }

    /**
     * 分析文本节点
     * @param {Text} textNode - 文本节点
     * @returns {boolean} 是否找到价格
     */
    analyzeTextNode(textNode) {
      const text = textNode.textContent;
      if (!text || text.trim().length === 0) return false;

      let foundPrice = false;

      for (const patternDef of this.currencyPatterns) {
        const pattern = new RegExp(patternDef.pattern);
        let match;
        
        while ((match = pattern.exec(text)) !== null) {
          try {
            const priceData = this.extractPriceData(match, patternDef);
            if (this.validatePrice(priceData)) {
              this.markElement(textNode.parentElement, priceData);
              foundPrice = true;
              break; // 一个元素只标记一次
            }
          } catch (error) {
            // 单个识别失败不影响其他
            continue;
          }
        }
        
        if (foundPrice) break;
      }

      return foundPrice;
    }

    /**
     * 提取价格数据
     * @param {Array} match - 正则匹配结果
     * @param {Object} patternDef - 模式定义
     * @returns {Object} 价格数据对象
     */
    extractPriceData(match, patternDef) {
      let currency = match[patternDef.currencyGroup];
      const amountStr = match[patternDef.amountGroup];
      
      // 处理带前缀的货币符号（如 US$, HK$）
      if (patternDef.withPrefix && currency) {
        currency = currency + '$';
      } else if (patternDef.prefixSymbol) {
        // 从匹配的文本中提取完整的货币符号
        const symbolMatch = match[0].match(/([A-Z]{2,3})?[$¥€£₹₩]/);
        if (symbolMatch) {
          currency = symbolMatch[0];
        }
      }
      
      return {
        originalText: match[0],
        currency: this.normalizeCurrency(currency || '$'),
        amount: this.parseAmount(amountStr, patternDef.europeanFormat),
        position: match.index
      };
    }

    /**
     * 货币符号标准化
     * @param {string} currencyStr - 货币符号或代码
     * @returns {string} 标准化的货币代码
     */
    normalizeCurrency(currencyStr) {
      const symbolMap = {
        '$': 'USD',
        '¥': 'CNY',  // 默认CNY，也可能是JPY
        '€': 'EUR',
        '£': 'GBP',
        '₹': 'INR',
        '₩': 'KRW',
        '₽': 'RUB',
        'A$': 'AUD',
        'AU$': 'AUD',
        'C$': 'CAD',
        'CA$': 'CAD',
        'HK$': 'HKD',
        'NT$': 'TWD',
        'S$': 'SGD',
        'SG$': 'SGD',
        'US$': 'USD',
        'NZ$': 'NZD'
      };
      
      return symbolMap[currencyStr] || currencyStr;
    }

    /**
     * 解析金额（处理千分位）
     * @param {string} amountStr - 金额字符串
     * @param {boolean} europeanFormat - 是否是欧洲格式
     * @returns {number} 解析后的金额
     */
    parseAmount(amountStr, europeanFormat = false) {
      if (europeanFormat) {
        // 欧洲格式：1.234,56 -> 1234.56
        return parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
      } else {
        // 标准格式：1,234.56 -> 1234.56
        return parseFloat(amountStr.replace(/[,\s]/g, ''));
      }
    }

    /**
     * 验证价格（排除误识别）
     * @param {Object} priceData - 价格数据对象
     * @returns {boolean} 是否是有效价格
     */
    validatePrice(priceData) {
      const minAmount = this.config.get('minAmount') || 0.01;
      const maxAmount = this.config.get('maxAmount') || 999999999;

      // 金额范围检查
      if (priceData.amount < minAmount || priceData.amount > maxAmount) {
        return false;
      }

      // 排除明显的日期格式（如 2024.10.21）
      if (priceData.amount > 1000 && priceData.amount < 9999) {
        const str = priceData.originalText;
        if (/\d{4}[.\/]\d{1,2}[.\/]\d{1,2}/.test(str)) {
          return false;
        }
      }

      // 排除电话号码格式
      if (priceData.originalText.replace(/\D/g, '').length > 10) {
        return false;
      }

      return true;
    }

    /**
     * 扫描价格容器元素（处理分离的货币符号和数字）
     * @returns {number} 找到的价格数量
     */
    scanPriceContainers() {
      // 查找可能包含价格的容器
      const priceSelectors = [
        '[class*="price"]',
        '[class*="pricing"]',
        '[class*="cost"]',
        '[class*="amount"]',
        '[data-price]',
        '[itemprop="price"]'
      ];

      let count = 0;
      const containers = document.querySelectorAll(priceSelectors.join(','));

      for (const container of containers) {
        // 跳过已标记或不可见的元素
        if (container.classList.contains('cc-price-detected') || 
            container.closest('.cc-tooltip') ||
            container.offsetParent === null) {
          continue;
        }

        // 获取容器的纯文本内容
        const text = container.textContent.trim();
        if (!text || text.length > 100) continue; // 跳过过长的文本

        // 尝试识别价格
        if (this.analyzePriceContainer(container, text)) {
          count++;
        }
      }

      return count;
    }

    /**
     * 分析价格容器
     * @param {HTMLElement} container - 容器元素
     * @param {string} text - 容器的文本内容
     * @returns {boolean} 是否找到价格
     */
    analyzePriceContainer(container, text) {
      for (const patternDef of this.currencyPatterns) {
        const pattern = new RegExp(patternDef.pattern);
        const match = pattern.exec(text);
        
        if (match) {
          try {
            const priceData = this.extractPriceData(match, patternDef);
            if (this.validatePrice(priceData)) {
              // 标记容器元素，而不是文本节点的父元素
              this.markElement(container, priceData);
              return true;
            }
          } catch (error) {
            continue;
          }
        }
      }
      
      return false;
    }

    /**
     * 标记元素
     * @param {HTMLElement} element - 要标记的元素
     * @param {Object} priceData - 价格数据对象
     */
    markElement(element, priceData) {
      if (!element || this.detectedElements.has(element)) return;

      try {
        element.dataset.ccOriginalPrice = priceData.amount;
        element.dataset.ccCurrency = priceData.currency;
        element.classList.add('cc-price-detected');
        this.detectedElements.set(element, priceData);
      } catch (error) {
        console.warn('[CC] Failed to mark element:', error);
      }
    }
  }

  /* ==================== UI工具提示管理器 ==================== */
  
  /**
   * 工具提示管理器类
   * 负责监听鼠标事件、渲染工具提示、显示转换结果
   */
  class TooltipManager {
    constructor(rateManager, configManager) {
      this.rateManager = rateManager;
      this.config = configManager;
      this.currentTooltip = null;
      this.hoverTimer = null;
      this.hideTimer = null;
      this.init();
    }

    /**
     * 初始化
     */
    init() {
      this.injectStyles();
      this.attachEvents();
    }

    /**
     * 绑定事件
     */
    attachEvents() {
      // 使用事件委托监听鼠标事件
      const debouncedMouseOver = Utils.debounce(this.handleMouseOver.bind(this), this.config.get('tooltipDelay'));
      
      document.body.addEventListener('mouseover', (e) => {
        const target = e.target.closest('.cc-price-detected');
        if (target) {
          debouncedMouseOver(e);
        }
      });

      document.body.addEventListener('mouseout', this.handleMouseOut.bind(this));
    }

    /**
     * 处理鼠标悬停
     * @param {MouseEvent} event - 鼠标事件
     */
    handleMouseOver(event) {
      const target = event.target.closest('.cc-price-detected');
      if (!target) return;

      clearTimeout(this.hideTimer);
      this.showTooltip(target, event);
    }

    /**
     * 处理鼠标移出
     * @param {MouseEvent} event - 鼠标事件
     */
    handleMouseOut(event) {
      const target = event.target.closest('.cc-price-detected');
      if (!target) return;

      clearTimeout(this.hoverTimer);
      
      // 延迟隐藏，给用户时间移动到tooltip
      this.hideTimer = setTimeout(() => {
        if (this.currentTooltip && !this.currentTooltip.matches(':hover')) {
          this.hideTooltip();
        }
      }, 200);
    }

    /**
     * 显示工具提示
     * @param {HTMLElement} element - 价格元素
     * @param {MouseEvent} event - 鼠标事件
     */
    async showTooltip(element, event) {
      const amount = parseFloat(element.dataset.ccOriginalPrice);
      const fromCurrency = element.dataset.ccCurrency;
      
      if (!amount || !fromCurrency) return;

      // 获取汇率
      let rates;
      try {
        rates = await this.rateManager.getRates('USD');
      } catch (error) {
        console.error('[CC] Failed to get rates:', error);
        this.showErrorTooltip(element, '汇率数据暂时不可用');
        return;
      }

      // 获取目标货币列表
      const targetCurrencies = this.config.get('targetCurrencies') || ['CNY', 'USD', 'EUR'];
      
      // 计算转换结果
      const conversions = targetCurrencies.map(toCurrency => {
        try {
          const converted = this.rateManager.convert(amount, fromCurrency, toCurrency);
          return {
            currency: toCurrency,
            amount: converted,
            formatted: this.formatCurrency(converted, toCurrency)
          };
        } catch (error) {
          return null;
        }
      }).filter(c => c !== null);

      if (conversions.length === 0) {
        this.showErrorTooltip(element, '无法转换货币');
        return;
      }

      // 渲染tooltip
      this.renderTooltip(element, {
        original: { amount, currency: fromCurrency },
        conversions,
        rates,
        timestamp: rates.timestamp
      });
    }

    /**
     * 渲染工具提示
     * @param {HTMLElement} anchor - 锚点元素
     * @param {Object} data - 数据对象
     */
    renderTooltip(anchor, data) {
      // 移除旧tooltip
      this.hideTooltip();

      // 创建tooltip元素
      const tooltip = document.createElement('div');
      tooltip.className = 'cc-tooltip';
      tooltip.innerHTML = this.buildTooltipHTML(data);

      document.body.appendChild(tooltip);
      this.currentTooltip = tooltip;

      // 绑定关闭按钮事件
      const closeBtn = tooltip.querySelector('.cc-tooltip-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.hideTooltip();
        });
      }

      // 定位
      this.positionTooltip(tooltip, anchor);

      // 添加动画
      requestAnimationFrame(() => {
        tooltip.classList.add('cc-tooltip-visible');
      });
    }

    /**
     * 构建工具提示HTML
     * @param {Object} data - 数据对象
     * @returns {string} HTML字符串
     */
    buildTooltipHTML(data) {
      const { original, conversions, rates, timestamp } = data;
      
      const updateTime = new Date(timestamp).toLocaleTimeString('zh-CN');
      
      return `
        <button class="cc-tooltip-close" title="关闭">&times;</button>
        <div class="cc-tooltip-header">
          <span class="cc-original">
            ${this.formatCurrency(original.amount, original.currency)}
          </span>
        </div>
        <div class="cc-tooltip-body">
          ${conversions.map(conv => `
            <div class="cc-conversion-row">
              <span class="cc-currency-code">${conv.currency}</span>
              <span class="cc-converted-amount">${conv.formatted}</span>
            </div>
          `).join('')}
        </div>
        <div class="cc-tooltip-footer">
          <span class="cc-update-time">更新: ${updateTime}</span>
          <span class="cc-source">${rates.source}</span>
        </div>
      `;
    }

    /**
     * 显示错误提示
     * @param {HTMLElement} anchor - 锚点元素
     * @param {string} message - 错误信息
     */
    showErrorTooltip(anchor, message) {
      this.hideTooltip();

      const tooltip = document.createElement('div');
      tooltip.className = 'cc-tooltip cc-tooltip-error';
      
      // 判断是否是API配额问题
      const isApiQuotaError = message.includes('不可用') || message.includes('failed');
      
      tooltip.innerHTML = `
        <button class="cc-tooltip-close" title="关闭">&times;</button>
        <div class="cc-tooltip-body">
          <div class="cc-error-message">⚠️ ${Utils.escapeHTML(message)}</div>
          ${isApiQuotaError ? `
            <div class="cc-error-hint">
              💡 可能是API配额用完了<br>
              <small>点击油猴菜单 → API密钥配置</small>
            </div>
          ` : ''}
        </div>
      `;

      document.body.appendChild(tooltip);
      this.currentTooltip = tooltip;

      // 绑定关闭按钮事件
      const closeBtn = tooltip.querySelector('.cc-tooltip-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.hideTooltip();
        });
      }

      this.positionTooltip(tooltip, anchor);

      requestAnimationFrame(() => {
        tooltip.classList.add('cc-tooltip-visible');
      });

      // 自动隐藏错误提示
      setTimeout(() => this.hideTooltip(), isApiQuotaError ? 5000 : 3000);
    }

    /**
     * 定位工具提示
     * @param {HTMLElement} tooltip - 工具提示元素
     * @param {HTMLElement} anchor - 锚点元素
     */
    positionTooltip(tooltip, anchor) {
      const anchorRect = anchor.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      // 默认显示在元素下方
      let top = anchorRect.bottom + window.scrollY + 8;
      let left = anchorRect.left + window.scrollX;

      // 防止超出右侧视口
      if (left + tooltipRect.width > window.innerWidth) {
        left = window.innerWidth - tooltipRect.width - 10;
      }

      // 防止超出左侧视口
      if (left < 10) {
        left = 10;
      }

      // 防止超出底部视口，显示在上方
      if (top + tooltipRect.height > window.innerHeight + window.scrollY) {
        top = anchorRect.top + window.scrollY - tooltipRect.height - 8;
      }

      // 防止超出顶部视口
      if (top < window.scrollY + 10) {
        top = window.scrollY + 10;
      }

      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
    }

    /**
     * 隐藏工具提示
     */
    hideTooltip() {
      if (this.currentTooltip) {
        this.currentTooltip.remove();
        this.currentTooltip = null;
      }
    }

    /**
     * 格式化货币显示
     * @param {number} amount - 金额
     * @param {string} currency - 货币代码
     * @returns {string} 格式化后的货币字符串
     */
    formatCurrency(amount, currency) {
      try {
        return new Intl.NumberFormat('zh-CN', {
          style: 'currency',
          currency: currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(amount);
      } catch (error) {
        // 如果货币代码不支持，使用简单格式
        return `${currency} ${Utils.formatNumber(amount)}`;
      }
    }

    /**
     * 注入CSS样式
     */
    injectStyles() {
      GM_addStyle(`
        /* 价格元素样式 */
        .cc-price-detected {
          cursor: help;
          position: relative;
          text-decoration: underline;
          text-decoration-style: dotted;
          text-decoration-color: #667eea;
          text-underline-offset: 2px;
        }

        /* 工具提示基础样式 */
        .cc-tooltip {
          position: absolute;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 12px 16px;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          z-index: 999999;
          min-width: 220px;
          max-width: 320px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 14px;
          opacity: 0;
          transform: translateY(-10px);
          transition: opacity 0.2s ease, transform 0.2s ease;
          pointer-events: auto;
        }

        /* 关闭按钮样式 */
        .cc-tooltip-close {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 24px;
          height: 24px;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          border-radius: 50%;
          color: white;
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          padding: 0;
          z-index: 1;
        }

        .cc-tooltip-close:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: scale(1.1);
        }

        .cc-tooltip-close:active {
          transform: scale(0.95);
        }

        .cc-tooltip-visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* 错误提示样式 */
        .cc-tooltip-error {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        }

        /* 头部样式 */
        .cc-tooltip-header {
          font-weight: bold;
          font-size: 16px;
          margin-bottom: 10px;
          padding-bottom: 8px;
          padding-right: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.3);
        }

        .cc-original {
          display: block;
          text-align: center;
        }

        /* 主体样式 */
        .cc-tooltip-body {
          margin: 0;
        }

        .cc-conversion-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 6px 0;
          padding: 4px 0;
        }

        .cc-currency-code {
          font-weight: 600;
          opacity: 0.9;
          font-size: 13px;
        }

        .cc-converted-amount {
          font-weight: bold;
          font-size: 15px;
        }

        /* 底部样式 */
        .cc-tooltip-footer {
          margin-top: 10px;
          padding-top: 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.3);
          font-size: 11px;
          opacity: 0.8;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .cc-update-time {
          font-size: 10px;
        }

        .cc-source {
          font-size: 10px;
          text-transform: uppercase;
        }

        /* 错误消息样式 */
        .cc-error-message {
          text-align: center;
          padding: 8px;
          font-size: 13px;
        }

        .cc-error-hint {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.3);
          font-size: 12px;
          text-align: center;
          line-height: 1.5;
        }

        .cc-error-hint small {
          font-size: 11px;
          opacity: 0.9;
        }

        /* 响应式 */
        @media (max-width: 480px) {
          .cc-tooltip {
            min-width: 180px;
            max-width: calc(100vw - 20px);
            font-size: 12px;
          }
          
          .cc-tooltip-header {
            font-size: 14px;
          }
          
          .cc-converted-amount {
            font-size: 13px;
          }
        }
      `);
    }
  }

  /* ==================== 设置面板（简化版） ==================== */
  
  /**
   * 简化版设置面板类
   * 主要用于API密钥配置
   */
  class SettingsPanel {
    constructor(configManager) {
      this.config = configManager;
      this.panel = null;
      this.registerMenuCommand();
    }

    /**
     * 注册油猴菜单命令
     */
    registerMenuCommand() {
      GM_registerMenuCommand('⚙️ API密钥配置', () => {
        this.show();
      });
      
      GM_registerMenuCommand('🔍 查看当前配置', () => {
        const apiKeys = this.config.get('apiKeys');
        const isCustom = (key, defaultKey) => key !== defaultKey ? '✅ 自定义' : '📦 默认';
        
        const info = `
当前API密钥配置：

ExchangeRate-API: 
  ${apiKeys.exchangeRateApi.substring(0, 8)}****${apiKeys.exchangeRateApi.substring(apiKeys.exchangeRateApi.length - 4)}
  ${isCustom(apiKeys.exchangeRateApi, DEFAULT_CONFIG.apiKeys.exchangeRateApi)}

Fixer.io: 
  ${apiKeys.fixer.substring(0, 8)}****${apiKeys.fixer.substring(apiKeys.fixer.length - 4)}
  ${isCustom(apiKeys.fixer, DEFAULT_CONFIG.apiKeys.fixer)}

CurrencyAPI: 
  ${apiKeys.currencyapi.substring(0, 8)}****${apiKeys.currencyapi.substring(apiKeys.currencyapi.length - 4)}
  ${isCustom(apiKeys.currencyapi, DEFAULT_CONFIG.apiKeys.currencyapi)}

目标货币: ${this.config.get('targetCurrencies').join(', ')}
缓存时间: ${this.config.get('cacheExpiry') / 1000}秒
        `.trim();
        
        alert(info);
      });
      
      GM_registerMenuCommand('🔄 重置配置', () => {
        if (confirm('确定要重置所有配置吗？（将恢复默认API密钥）')) {
          this.config.reset();
          alert('配置已重置！刷新页面后生效。');
          location.reload();
        }
      });
    }

    /**
     * 显示设置面板
     */
    show() {
      if (this.panel) {
        this.panel.style.display = 'flex';
        this.loadCurrentSettings();
        return;
      }

      this.panel = this.create();
      document.body.appendChild(this.panel);
      this.loadCurrentSettings();
    }

    /**
     * 创建设置面板
     */
    create() {
      const panel = document.createElement('div');
      panel.className = 'cc-settings-panel';
      panel.innerHTML = `
        <div class="cc-settings-overlay"></div>
        <div class="cc-settings-modal">
          <div class="cc-settings-header">
            <h2>💱 API密钥配置</h2>
            <button class="cc-close-btn" id="cc-close">&times;</button>
          </div>
          <div class="cc-settings-body">
            <div class="cc-info-box">
              <p>📝 如果默认API配额用完，可以免费申请自己的API密钥：</p>
            </div>
            
            <div class="cc-setting-group">
              <label>
                <strong>ExchangeRate-API</strong> 
                <a href="https://www.exchangerate-api.com/" target="_blank">获取密钥 →</a>
              </label>
              <small>免费额度：1,500请求/月</small>
              <input type="text" id="cc-key-exchangerate" placeholder="输入API密钥（可选）" />
            </div>

            <div class="cc-setting-group">
              <label>
                <strong>Fixer.io</strong>
                <a href="https://fixer.io/" target="_blank">获取密钥 →</a>
              </label>
              <small>免费额度：100请求/月</small>
              <input type="text" id="cc-key-fixer" placeholder="输入API密钥（可选）" />
            </div>

            <div class="cc-setting-group">
              <label>
                <strong>CurrencyAPI</strong>
                <a href="https://currencyapi.com/" target="_blank">获取密钥 →</a>
              </label>
              <small>免费额度：300请求/月</small>
              <input type="text" id="cc-key-currencyapi" placeholder="输入API密钥（可选）" />
            </div>

            <div class="cc-info-box cc-tip">
              <p>💡 <strong>提示：</strong></p>
              <ul>
                <li>留空则使用默认密钥</li>
                <li>建议至少配置一个API密钥作为备用</li>
                <li>保存后需要刷新页面生效</li>
                <li>打开浏览器控制台(F12)可查看密钥使用情况</li>
              </ul>
            </div>
            
            <div class="cc-info-box" style="background: #f0fdf4; border-left-color: #10b981;">
              <p style="color: #065f46;">🔍 <strong>查看当前配置：</strong></p>
              <p style="color: #065f46; font-size: 13px;">保存后可通过油猴菜单 → "🔍 查看当前配置" 查看已保存的密钥（部分遮盖）</p>
            </div>
          </div>
          <div class="cc-settings-footer">
            <button class="cc-btn cc-btn-secondary" id="cc-cancel">取消</button>
            <button class="cc-btn cc-btn-primary" id="cc-save">保存配置</button>
          </div>
        </div>
      `;

      this.attachEvents(panel);
      this.injectPanelStyles();
      return panel;
    }

    /**
     * 加载当前设置
     */
    loadCurrentSettings() {
      const apiKeys = this.config.get('apiKeys');
      const exchangeInput = document.getElementById('cc-key-exchangerate');
      const fixerInput = document.getElementById('cc-key-fixer');
      const currencyapiInput = document.getElementById('cc-key-currencyapi');

      if (exchangeInput && apiKeys.exchangeRateApi) {
        exchangeInput.value = apiKeys.exchangeRateApi;
      }
      if (fixerInput && apiKeys.fixer) {
        fixerInput.value = apiKeys.fixer;
      }
      if (currencyapiInput && apiKeys.currencyapi) {
        currencyapiInput.value = apiKeys.currencyapi;
      }
    }

    /**
     * 绑定事件
     */
    attachEvents(panel) {
      // 关闭按钮
      panel.querySelector('#cc-close').addEventListener('click', () => {
        this.hide();
      });

      panel.querySelector('#cc-cancel').addEventListener('click', () => {
        this.hide();
      });

      // 保存按钮
      panel.querySelector('#cc-save').addEventListener('click', () => {
        this.saveSettings();
      });

      // 点击遮罩层关闭
      panel.querySelector('.cc-settings-overlay').addEventListener('click', () => {
        this.hide();
      });
    }

    /**
     * 保存设置
     */
    saveSettings() {
      const exchangeKey = document.getElementById('cc-key-exchangerate').value.trim();
      const fixerKey = document.getElementById('cc-key-fixer').value.trim();
      const currencyapiKey = document.getElementById('cc-key-currencyapi').value.trim();

      const newApiKeys = {};
      
      // 使用用户提供的密钥，如果为空则使用默认密钥
      newApiKeys.exchangeRateApi = exchangeKey || DEFAULT_CONFIG.apiKeys.exchangeRateApi;
      newApiKeys.fixer = fixerKey || DEFAULT_CONFIG.apiKeys.fixer;
      newApiKeys.currencyapi = currencyapiKey || DEFAULT_CONFIG.apiKeys.currencyapi;

      this.config.save({
        apiKeys: newApiKeys
      });

      alert('✅ API密钥已保存！\n\n刷新页面后生效。');
      this.hide();
      
      // 3秒后自动刷新
      setTimeout(() => {
        location.reload();
      }, 1000);
    }

    /**
     * 隐藏设置面板
     */
    hide() {
      if (this.panel) {
        this.panel.style.display = 'none';
      }
    }

    /**
     * 注入设置面板样式
     */
    injectPanelStyles() {
      GM_addStyle(`
        .cc-settings-panel {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 9999999;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cc-settings-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
        }

        .cc-settings-modal {
          position: relative;
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          max-width: 600px;
          width: 90%;
          max-height: 80vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: cc-modal-in 0.3s ease;
        }

        @keyframes cc-modal-in {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .cc-settings-header {
          padding: 20px 24px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .cc-settings-header h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
        }

        .cc-close-btn {
          background: none;
          border: none;
          color: white;
          font-size: 32px;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .cc-close-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .cc-settings-body {
          padding: 24px;
          overflow-y: auto;
          flex: 1;
        }

        .cc-info-box {
          background: #eff6ff;
          border-left: 4px solid #3b82f6;
          padding: 12px 16px;
          margin-bottom: 20px;
          border-radius: 4px;
        }

        .cc-info-box.cc-tip {
          background: #fef3c7;
          border-left-color: #f59e0b;
        }

        .cc-info-box p {
          margin: 0 0 8px 0;
          color: #1e40af;
          font-size: 14px;
        }

        .cc-info-box.cc-tip p {
          color: #92400e;
        }

        .cc-info-box ul {
          margin: 0;
          padding-left: 20px;
          color: #92400e;
          font-size: 13px;
        }

        .cc-info-box ul li {
          margin: 4px 0;
        }

        .cc-setting-group {
          margin-bottom: 20px;
        }

        .cc-setting-group label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #374151;
        }

        .cc-setting-group label a {
          color: #667eea;
          text-decoration: none;
          font-size: 13px;
          margin-left: 8px;
          font-weight: normal;
        }

        .cc-setting-group label a:hover {
          text-decoration: underline;
        }

        .cc-setting-group small {
          display: block;
          color: #6b7280;
          font-size: 12px;
          margin-bottom: 8px;
        }

        .cc-setting-group input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          font-family: 'Courier New', monospace;
          transition: border-color 0.2s;
        }

        .cc-setting-group input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .cc-settings-footer {
          padding: 16px 24px;
          border-top: 1px solid #e5e7eb;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          background: #f9fafb;
        }

        .cc-btn {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .cc-btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .cc-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .cc-btn-secondary {
          background: #e5e7eb;
          color: #374151;
        }

        .cc-btn-secondary:hover {
          background: #d1d5db;
        }

        @media (max-width: 640px) {
          .cc-settings-modal {
            width: 95%;
            max-height: 90vh;
          }

          .cc-settings-header,
          .cc-settings-body,
          .cc-settings-footer {
            padding: 16px;
          }
        }
      `);
    }
  }

  /* ==================== 动态内容监听 ==================== */
  
  /**
   * 设置动态内容观察器
   * 用于监听DOM变化，支持SPA网站
   * @param {CurrencyDetector} detector - 货币检测器实例
   */
  function setupDynamicObserver(detector) {
    // 使用节流优化性能
    const throttledScan = Utils.throttle((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              detector.scanElement(node);
            }
          });
        }
      }
    }, 300);

    const observer = new MutationObserver(throttledScan);

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('[CC] MutationObserver started for dynamic content');
  }

  /* ==================== 主程序初始化 ==================== */
  
  /**
   * 主初始化函数
   */
  function init() {
    console.log('%c💱 Currency Converter v1.0.0 Loaded', 
      'color: #667eea; font-size: 14px; font-weight: bold;');

    try {
      // 1. 实例化配置管理器
      const configManager = new ConfigManager();
      console.log('[CC] ConfigManager initialized');

      // 2. 实例化汇率管理器
      const rateManager = new ExchangeRateManager(configManager);
      console.log('[CC] ExchangeRateManager initialized');

      // 3. 实例化价格检测器
      const detector = new CurrencyDetector(configManager);
      console.log('[CC] CurrencyDetector initialized');

      // 4. 实例化工具提示管理器
      const tooltipManager = new TooltipManager(rateManager, configManager);
      console.log('[CC] TooltipManager initialized');

      // 4.5. 实例化设置面板
      const settingsPanel = new SettingsPanel(configManager);
      console.log('[CC] SettingsPanel initialized');

      // 5. 延迟扫描页面（性能优化）
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          detector.scanPage();
        }, { timeout: 2000 });
      } else {
        setTimeout(() => {
          detector.scanPage();
        }, 1000);
      }

      // 6. 设置动态内容监听
      setupDynamicObserver(detector);

      // 7. 预加载汇率数据
      rateManager.getRates('USD').then(() => {
        console.log('[CC] Exchange rates preloaded');
      }).catch(err => {
        console.warn('[CC] Failed to preload rates:', err.message);
      });

      console.log('%c✅ Currency Converter is ready!', 'color: #10b981; font-size: 12px; font-weight: bold;');
    } catch (error) {
      console.error('[CC] Initialization failed:', error);
    }
  }

  /* ==================== 全局错误处理 ==================== */
  
  window.addEventListener('error', (event) => {
    // 只处理本脚本的错误
    if (event.error && event.error.stack && event.error.stack.includes('currency')) {
      console.error('[CC] Script error:', event.error);
      // 防止错误传播到页面
      event.preventDefault();
    }
  });

  /* ==================== 启动脚本 ==================== */
  
  // 在DOM就绪后执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

