// ==UserScript==
// @name         ✨✨✨全能货币转换器 - Universal Currency Converter✨✨✨
// @name:en      Universal Currency Converter
// @namespace    https://greasyfork.org/users/currency-converter
// @version      1.3.0
// @description  ✨✨✨智能识别网页价格，鼠标悬停即可查看实时汇率转换。支持15+主流货币，使用免费API，数据缓存，性能优化。
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
// @connect      ipapi.co
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
    // 目标货币列表（最多5个，可在设置中修改）
    targetCurrencies: ['CNY', 'USD', 'EUR', 'GBP', 'JPY'],
    
    // 智能货币显示
    autoDetectLocation: true,  // 根据IP自动检测用户所在国家
    excludeSourceCurrency: true, // 排除原货币（如价格是USD就不显示USD转换）
    userCountryCurrency: null,  // 用户所在国家货币（自动检测后保存）
    maxDisplayCurrencies: 3,    // 最多显示的货币数量
    
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

  /* ==================== 地理位置检测模块 ==================== */
  
  /**
   * 地理位置检测器类
   * 根据IP地址检测用户所在国家，并映射到对应货币
   */
  class GeoLocationDetector {
    constructor(configManager) {
      this.config = configManager;
      this.countryToCurrency = {
        'US': 'USD', 'CN': 'CNY', 'GB': 'GBP', 'JP': 'JPY', 'EU': 'EUR',
        'DE': 'EUR', 'FR': 'EUR', 'IT': 'EUR', 'ES': 'EUR', 'NL': 'EUR',
        'HK': 'HKD', 'TW': 'TWD', 'KR': 'KRW', 'AU': 'AUD', 'CA': 'CAD',
        'SG': 'SGD', 'CH': 'CHF', 'RU': 'RUB', 'IN': 'INR', 'BR': 'BRL',
        'MX': 'MXN', 'ID': 'IDR', 'TR': 'TRY', 'SA': 'SAR', 'ZA': 'ZAR'
      };
    }

    /**
     * 检测用户所在国家并返回对应货币
     * @returns {Promise<string|null>} 国家对应的货币代码
     */
    async detectUserCurrency() {
      // 先检查是否已缓存
      const cached = this.config.get('userCountryCurrency');
      if (cached) {
        console.log(`[CC] 使用缓存的用户国家货币: ${cached}`);
        return cached;
      }

      // 如果用户禁用了自动检测
      if (!this.config.get('autoDetectLocation')) {
        console.log('[CC] 自动检测已禁用');
        return null;
      }

      try {
        console.log('[CC] 正在检测用户地理位置...');
        
        // 使用免费IP地理位置API（ipapi.co）
        const countryCode = await this.fetchCountryCode();
        
        if (!countryCode) {
          console.log('[CC] 无法获取国家代码');
          return null;
        }

        const currency = this.countryToCurrency[countryCode] || null;
        
        if (currency) {
          console.log(`[CC] 🌍 检测到用户位于: ${countryCode}, 货币: ${currency}`);
          // 保存到配置
          this.config.save({ userCountryCurrency: currency });
          return currency;
        } else {
          console.log(`[CC] 国家代码 ${countryCode} 未映射到货币`);
          return null;
        }
      } catch (error) {
        console.error('[CC] 地理位置检测失败:', error);
        return null;
      }
    }

    /**
     * 调用IP API获取国家代码
     * @returns {Promise<string|null>}
     */
    async fetchCountryCode() {
      return new Promise((resolve) => {
        GM_xmlhttpRequest({
          method: 'GET',
          url: 'https://ipapi.co/country/',
          timeout: 5000,
          onload: (response) => {
            if (response.status === 200) {
              const countryCode = response.responseText.trim().toUpperCase();
              resolve(countryCode);
            } else {
              console.warn('[CC] IP API返回错误:', response.status);
              resolve(null);
            }
          },
          onerror: (error) => {
            console.error('[CC] IP API请求失败:', error);
            resolve(null);
          },
          ontimeout: () => {
            console.warn('[CC] IP API请求超时');
            resolve(null);
          }
        });
      });
    }

    /**
     * 手动设置用户国家货币
     * @param {string} currency - 货币代码
     */
    setUserCurrency(currency) {
      this.config.save({ userCountryCurrency: currency });
      console.log(`[CC] 用户国家货币已设置为: ${currency}`);
    }

    /**
     * 清除缓存的国家货币
     */
    clearCache() {
      this.config.save({ userCountryCurrency: null });
      console.log('[CC] 已清除用户国家货币缓存');
    }
  }

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

      // 获取智能排序的目标货币列表
      const targetCurrencies = this.getSmartTargetCurrencies(fromCurrency);
      
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
     * 获取智能排序的目标货币列表
     * @param {string} sourceCurrency - 原货币代码
     * @returns {Array<string>} 目标货币列表
     */
    getSmartTargetCurrencies(sourceCurrency) {
      // 获取所有配置的目标货币
      let targetCurrencies = this.config.get('targetCurrencies') || ['CNY', 'USD', 'EUR', 'GBP', 'JPY'];
      
      // 是否排除原货币
      if (this.config.get('excludeSourceCurrency')) {
        targetCurrencies = targetCurrencies.filter(c => c !== sourceCurrency);
      }
      
      // 获取用户国家货币（优先显示）
      const userCountryCurrency = this.config.get('userCountryCurrency');
      
      // 智能排序：用户国家货币 > 其他配置货币
      if (userCountryCurrency && userCountryCurrency !== sourceCurrency) {
        // 移除用户国家货币（如果在列表中）
        targetCurrencies = targetCurrencies.filter(c => c !== userCountryCurrency);
        // 添加到第一位
        targetCurrencies.unshift(userCountryCurrency);
      }
      
      // 限制显示数量
      const maxDisplay = this.config.get('maxDisplayCurrencies') || 3;
      targetCurrencies = targetCurrencies.slice(0, maxDisplay);
      
      console.log(`[CC] 目标货币: ${targetCurrencies.join(', ')} (原货币: ${sourceCurrency})`);
      
      return targetCurrencies;
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
          background: white;
          color: #1f2937;
          padding: 12px 16px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1);
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
          background: #f3f4f6;
          border: none;
          border-radius: 50%;
          color: #6b7280;
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
          background: #e5e7eb;
          color: #1f2937;
          transform: scale(1.1);
        }

        .cc-tooltip-close:active {
          transform: scale(0.95);
          background: #d1d5db;
        }

        .cc-tooltip-visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* 错误提示样式 */
        .cc-tooltip-error {
          background: #fef2f2;
          border-color: #fecaca;
          color: #991b1b;
        }

        .cc-tooltip-error .cc-tooltip-header,
        .cc-tooltip-error .cc-converted-amount {
          color: #991b1b;
        }

        .cc-tooltip-error .cc-tooltip-header {
          border-bottom-color: #fecaca;
        }

        .cc-tooltip-error .cc-tooltip-close {
          background: rgba(239, 68, 68, 0.1);
          color: #dc2626;
        }

        .cc-tooltip-error .cc-tooltip-close:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #991b1b;
        }

        /* 头部样式 */
        .cc-tooltip-header {
          font-weight: bold;
          font-size: 16px;
          margin-bottom: 10px;
          padding-bottom: 8px;
          padding-right: 20px;
          border-bottom: 1px solid #e5e7eb;
          color: #1f2937;
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
          color: #6b7280;
          font-size: 13px;
        }

        .cc-converted-amount {
          font-weight: bold;
          font-size: 15px;
          color: #1f2937;
        }

        /* 底部样式 */
        .cc-tooltip-footer {
          margin-top: 10px;
          padding-top: 8px;
          border-top: 1px solid #e5e7eb;
          font-size: 11px;
          color: #9ca3af;
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
          border-top: 1px solid #fecaca;
          font-size: 12px;
          text-align: center;
          line-height: 1.5;
        }

        .cc-error-hint small {
          font-size: 11px;
          opacity: 0.9;
        }

        /* 暗色模式支持 - Tooltip */
        @media (prefers-color-scheme: dark) {
          .cc-tooltip {
            background: #1f2937;
            border-color: #374151;
            color: #f3f4f6;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3);
          }

          .cc-tooltip-close {
            background: #374151;
            color: #9ca3af;
          }

          .cc-tooltip-close:hover {
            background: #4b5563;
            color: #f3f4f6;
          }

          .cc-tooltip-close:active {
            background: #374151;
          }

          .cc-tooltip-header {
            border-bottom-color: #374151;
            color: #f3f4f6;
          }

          .cc-currency-code {
            color: #9ca3af;
          }

          .cc-converted-amount {
            color: #f3f4f6;
          }

          .cc-tooltip-footer {
            border-top-color: #374151;
            color: #6b7280;
          }

          .cc-error-hint {
            border-top-color: #374151;
          }

          /* 暗色模式下的错误提示 */
          .cc-tooltip-error {
            background: #7f1d1d;
            border-color: #991b1b;
            color: #fecaca;
          }

          .cc-tooltip-error .cc-tooltip-header,
          .cc-tooltip-error .cc-converted-amount {
            color: #fecaca;
          }

          .cc-tooltip-error .cc-tooltip-header {
            border-bottom-color: #991b1b;
          }

          .cc-tooltip-error .cc-tooltip-close {
            background: rgba(239, 68, 68, 0.2);
            color: #fca5a5;
          }

          .cc-tooltip-error .cc-tooltip-close:hover {
            background: rgba(239, 68, 68, 0.3);
            color: #fecaca;
          }
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
      GM_registerMenuCommand('⚙️ 设置面板', () => {
        this.show();
      });
      
      GM_registerMenuCommand('🔍 查看当前配置', () => {
        const apiKeys = this.config.get('apiKeys');
        const isCustom = (key, defaultKey) => key !== defaultKey ? '✅ 自定义' : '📦 默认';
        
        const info = `
【API密钥配置】
ExchangeRate-API: 
  ${apiKeys.exchangeRateApi.substring(0, 8)}****${apiKeys.exchangeRateApi.substring(apiKeys.exchangeRateApi.length - 4)}
  ${isCustom(apiKeys.exchangeRateApi, DEFAULT_CONFIG.apiKeys.exchangeRateApi)}

Fixer.io: 
  ${apiKeys.fixer.substring(0, 8)}****${apiKeys.fixer.substring(apiKeys.fixer.length - 4)}
  ${isCustom(apiKeys.fixer, DEFAULT_CONFIG.apiKeys.fixer)}

CurrencyAPI: 
  ${apiKeys.currencyapi.substring(0, 8)}****${apiKeys.currencyapi.substring(apiKeys.currencyapi.length - 4)}
  ${isCustom(apiKeys.currencyapi, DEFAULT_CONFIG.apiKeys.currencyapi)}

【显示设置】
目标货币: ${this.config.get('targetCurrencies').join(', ')}
最多显示: ${this.config.get('maxDisplayCurrencies')}个
IP自动检测: ${this.config.get('autoDetectLocation') ? '✅ 启用' : '❌ 禁用'}
排除原货币: ${this.config.get('excludeSourceCurrency') ? '✅ 启用' : '❌ 禁用'}
用户国家货币: ${this.config.get('userCountryCurrency') || '未检测'}
        `.trim();
        
        alert(info);
      });
      
      GM_registerMenuCommand('🔄 重置配置', () => {
        if (confirm('确定要重置所有配置吗？（将恢复默认设置）')) {
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
      const allCurrencies = ['USD', 'CNY', 'EUR', 'GBP', 'JPY', 'HKD', 'TWD', 'KRW', 'AUD', 'CAD', 'SGD', 'CHF', 'RUB', 'INR', 'BRL'];
      
      const panel = document.createElement('div');
      panel.className = 'cc-settings-panel';
      panel.innerHTML = `
        <div class="cc-settings-overlay"></div>
        <div class="cc-settings-modal">
          <div class="cc-settings-header">
            <h2>⚙️ 货币转换器设置</h2>
            <button class="cc-close-btn" id="cc-close">&times;</button>
          </div>
          <div class="cc-settings-body">
            <!-- 智能显示设置 -->
            <div class="cc-section">
              <h3>🎯 智能显示</h3>
              
              <div class="cc-setting-group">
                <label class="cc-checkbox-label">
                  <input type="checkbox" id="cc-auto-detect" />
                  <span><strong>根据IP自动检测所在国家</strong></span>
                </label>
                <small>启用后，优先显示你所在国家的货币（首次加载时检测）</small>
              </div>

              <div class="cc-setting-group">
                <label class="cc-checkbox-label">
                  <input type="checkbox" id="cc-exclude-source" />
                  <span><strong>排除原货币</strong></span>
                </label>
                <small>转换结果中不显示原价格的货币（例如：美元价格不再显示美元转换）</small>
              </div>

              <div class="cc-setting-group">
                <label>
                  <strong>最多显示货币数量</strong>
                </label>
                <select id="cc-max-display">
                  <option value="2">2个</option>
                  <option value="3">3个</option>
                  <option value="4">4个</option>
                  <option value="5">5个</option>
                </select>
              </div>
            </div>

            <!-- 目标货币选择 -->
            <div class="cc-section">
              <h3>💰 目标货币</h3>
              <small style="display: block; margin-bottom: 10px; color: #6b7280;">
                选择要显示的货币（至少2个，最多5个）
              </small>
              <div class="cc-currency-grid" id="cc-currency-checkboxes">
                ${allCurrencies.map(cur => `
                  <label class="cc-currency-option">
                    <input type="checkbox" name="cc-currency" value="${cur}" />
                    <span>${cur}</span>
                  </label>
                `).join('')}
              </div>
            </div>

            <!-- API密钥配置 -->
            <div class="cc-section">
              <h3>🔑 API密钥（可选）</h3>
              <div class="cc-info-box">
                <p>📝 如果默认API配额用完，可以免费申请自己的API密钥：</p>
              </div>
              
              <div class="cc-setting-group">
                <label>
                  <strong>ExchangeRate-API</strong> 
                  <a href="https://www.exchangerate-api.com/" target="_blank">获取密钥 →</a>
                </label>
                <small>免费额度：1,500请求/月</small>
                <input type="text" id="cc-key-exchangerate" placeholder="留空使用默认密钥" />
              </div>

              <div class="cc-setting-group">
                <label>
                  <strong>Fixer.io</strong>
                  <a href="https://fixer.io/" target="_blank">获取密钥 →</a>
                </label>
                <small>免费额度：100请求/月</small>
                <input type="text" id="cc-key-fixer" placeholder="留空使用默认密钥" />
              </div>

              <div class="cc-setting-group">
                <label>
                  <strong>CurrencyAPI</strong>
                  <a href="https://currencyapi.com/" target="_blank">获取密钥 →</a>
                </label>
                <small>免费额度：300请求/月</small>
                <input type="text" id="cc-key-currencyapi" placeholder="留空使用默认密钥" />
              </div>
            </div>

            <!-- 快捷键说明 -->
            <div class="cc-section">
              <h3>⌨️ 快捷键</h3>
              <div class="cc-info-box" style="background: #f0fdf4; border-left-color: #10b981;">
                <p style="color: #065f46; margin-bottom: 12px;"><strong>可用的快捷键：</strong></p>
                <div style="color: #065f46; font-size: 13px; line-height: 1.8;">
                  <div><kbd style="background: #d1fae5; padding: 2px 6px; border-radius: 3px; font-family: monospace;">Alt + C</kbd> - 打开/关闭货币计算器</div>
                  <div><kbd style="background: #d1fae5; padding: 2px 6px; border-radius: 3px; font-family: monospace;">Alt + H</kbd> - 隐藏/显示价格标记</div>
                  <div><kbd style="background: #d1fae5; padding: 2px 6px; border-radius: 3px; font-family: monospace;">Esc</kbd> - 关闭所有浮动窗口</div>
                </div>
              </div>
            </div>
          </div>
          <div class="cc-settings-footer">
            <button class="cc-btn cc-btn-secondary" id="cc-cancel">取消</button>
            <button class="cc-btn cc-btn-primary" id="cc-save">保存并刷新</button>
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
      // 加载智能显示设置
      const autoDetect = document.getElementById('cc-auto-detect');
      const excludeSource = document.getElementById('cc-exclude-source');
      const maxDisplay = document.getElementById('cc-max-display');
      
      if (autoDetect) {
        autoDetect.checked = this.config.get('autoDetectLocation');
      }
      if (excludeSource) {
        excludeSource.checked = this.config.get('excludeSourceCurrency');
      }
      if (maxDisplay) {
        maxDisplay.value = this.config.get('maxDisplayCurrencies') || 3;
      }

      // 加载目标货币
      const targetCurrencies = this.config.get('targetCurrencies') || ['CNY', 'USD', 'EUR', 'GBP', 'JPY'];
      const currencyCheckboxes = document.querySelectorAll('input[name="cc-currency"]');
      currencyCheckboxes.forEach(checkbox => {
        if (targetCurrencies.includes(checkbox.value)) {
          checkbox.checked = true;
        }
      });

      // 加载API密钥
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
      // 获取智能显示设置
      const autoDetect = document.getElementById('cc-auto-detect').checked;
      const excludeSource = document.getElementById('cc-exclude-source').checked;
      const maxDisplay = parseInt(document.getElementById('cc-max-display').value);

      // 获取选中的货币
      const selectedCurrencies = Array.from(document.querySelectorAll('input[name="cc-currency"]:checked'))
        .map(cb => cb.value);

      // 验证货币选择
      if (selectedCurrencies.length < 2) {
        alert('❌ 请至少选择2个目标货币！');
        return;
      }
      if (selectedCurrencies.length > 5) {
        alert('❌ 最多只能选择5个目标货币！');
        return;
      }

      // 获取API密钥
      const exchangeKey = document.getElementById('cc-key-exchangerate').value.trim();
      const fixerKey = document.getElementById('cc-key-fixer').value.trim();
      const currencyapiKey = document.getElementById('cc-key-currencyapi').value.trim();

      const newApiKeys = {};
      newApiKeys.exchangeRateApi = exchangeKey || DEFAULT_CONFIG.apiKeys.exchangeRateApi;
      newApiKeys.fixer = fixerKey || DEFAULT_CONFIG.apiKeys.fixer;
      newApiKeys.currencyapi = currencyapiKey || DEFAULT_CONFIG.apiKeys.currencyapi;

      // 保存所有配置
      const newConfig = {
        autoDetectLocation: autoDetect,
        excludeSourceCurrency: excludeSource,
        maxDisplayCurrencies: maxDisplay,
        targetCurrencies: selectedCurrencies,
        apiKeys: newApiKeys
      };

      // 如果禁用了自动检测，清除缓存的国家货币
      if (!autoDetect) {
        newConfig.userCountryCurrency = null;
      }

      this.config.save(newConfig);

      alert('✅ 配置已保存！\n\n页面即将刷新以应用新设置。');
      this.hide();
      
      // 1秒后自动刷新
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
          background: white;
          color: #1f2937;
        }

        .cc-settings-header h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: #1f2937;
        }

        .cc-close-btn {
          background: none;
          border: none;
          color: #6b7280;
          font-size: 32px;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .cc-close-btn:hover {
          background: #f3f4f6;
          color: #1f2937;
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

        .cc-setting-group select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          background: white;
          cursor: pointer;
          transition: border-color 0.2s;
        }

        .cc-setting-group select:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .cc-section {
          margin-bottom: 30px;
          padding-bottom: 24px;
          border-bottom: 1px solid #e5e7eb;
        }

        .cc-section:last-child {
          border-bottom: none;
        }

        .cc-section h3 {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .cc-checkbox-label {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          margin-bottom: 8px;
        }

        .cc-checkbox-label input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: #667eea;
        }

        .cc-currency-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          gap: 10px;
          margin-top: 10px;
        }

        .cc-currency-option {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px;
          border: 2px solid #e5e7eb;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          background: white;
        }

        .cc-currency-option:hover {
          border-color: #667eea;
          background: #f5f7ff;
        }

        .cc-currency-option input[type="checkbox"] {
          display: none;
        }

        .cc-currency-option input[type="checkbox"]:checked + span {
          color: white;
        }

        .cc-currency-option:has(input:checked) {
          background: #3b82f6;
          border-color: #3b82f6;
          box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
        }

        .cc-currency-option span {
          font-weight: 600;
          font-size: 14px;
          color: #374151;
          transition: color 0.2s;
        }

        .cc-currency-option:has(input:checked) span {
          color: white;
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
          background: #3b82f6;
          color: white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .cc-btn-primary:hover {
          background: #2563eb;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .cc-btn-primary:active {
          background: #1d4ed8;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .cc-btn-secondary {
          background: #e5e7eb;
          color: #374151;
        }

        .cc-btn-secondary:hover {
          background: #d1d5db;
        }

        /* 暗色模式支持 */
        @media (prefers-color-scheme: dark) {
          .cc-settings-modal {
            background: #1f2937;
            color: #f3f4f6;
          }

          .cc-settings-header {
            background: #1f2937;
            border-bottom-color: #374151;
          }

          .cc-settings-header h2 {
            color: #f3f4f6;
          }

          .cc-close-btn {
            color: #9ca3af;
          }

          .cc-close-btn:hover {
            background: #374151;
            color: #f3f4f6;
          }

          .cc-settings-body {
            background: #1f2937;
          }

          .cc-section {
            border-bottom-color: #374151;
          }

          .cc-section h3 {
            color: #f3f4f6;
          }

          .cc-info-box {
            background: #1e3a5f;
            border-left-color: #3b82f6;
          }

          .cc-info-box p {
            color: #93c5fd;
          }

          .cc-setting-group label {
            color: #f3f4f6;
          }

          .cc-setting-group small {
            color: #9ca3af;
          }

          .cc-setting-group input,
          .cc-setting-group select {
            background: #374151;
            border-color: #4b5563;
            color: #f3f4f6;
          }

          .cc-setting-group input:focus,
          .cc-setting-group select:focus {
            border-color: #3b82f6;
            background: #374151;
          }

          .cc-currency-option {
            background: #374151;
            border-color: #4b5563;
          }

          .cc-currency-option:hover {
            border-color: #3b82f6;
            background: #2d3748;
          }

          .cc-currency-option span {
            color: #f3f4f6;
          }

          .cc-btn-secondary {
            background: #374151;
            color: #f3f4f6;
          }

          .cc-btn-secondary:hover {
            background: #4b5563;
          }

          .cc-settings-footer {
            background: #111827;
            border-top-color: #374151;
          }
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

  /* ==================== 货币计算器 ==================== */
  
  /**
   * 货币计算器类
   * 提供独立的浮动计算器窗口
   */
  class CalculatorPanel {
    constructor(rateManager, configManager) {
      this.rateManager = rateManager;
      this.config = configManager;
      this.panel = null;
      this.isDragging = false;
      this.dragOffset = { x: 0, y: 0 };
      
      // 加载保存的配置
      this.position = this.loadPosition();
      this.fromCurrency = this.loadSavedCurrency('calcFromCurrency') || 'USD';
      this.toCurrency = this.loadSavedCurrency('calcToCurrency') || 'CNY';
      this.fromAmount = 100;
      
      this.create();
    }

    /**
     * 加载保存的位置
     */
    loadPosition() {
      try {
        const saved = GM_getValue('cc_calc_position');
        return saved ? JSON.parse(saved) : { x: window.innerWidth - 350, y: 100 };
      } catch (error) {
        return { x: window.innerWidth - 350, y: 100 };
      }
    }

    /**
     * 保存位置
     */
    savePosition() {
      try {
        GM_setValue('cc_calc_position', JSON.stringify(this.position));
      } catch (error) {
        console.error('[CC] Failed to save calculator position:', error);
      }
    }

    /**
     * 加载保存的货币
     */
    loadSavedCurrency(key) {
      try {
        return GM_getValue(key);
      } catch (error) {
        return null;
      }
    }

    /**
     * 保存货币选择
     */
    saveCurrency(key, currency) {
      try {
        GM_setValue(key, currency);
      } catch (error) {
        console.error('[CC] Failed to save currency:', error);
      }
    }

    /**
     * 创建计算器面板
     */
    create() {
      const supportedCurrencies = ['USD', 'CNY', 'EUR', 'GBP', 'JPY', 'HKD', 'TWD', 'KRW', 'AUD', 'CAD', 'SGD', 'CHF', 'RUB', 'INR', 'BRL'];
      
      this.panel = document.createElement('div');
      this.panel.className = 'cc-calculator-panel';
      this.panel.style.left = `${this.position.x}px`;
      this.panel.style.top = `${this.position.y}px`;
      this.panel.style.display = 'none';
      
      this.panel.innerHTML = `
        <div class="cc-calc-header" id="cc-calc-header">
          <span>💱 货币计算器</span>
          <button class="cc-calc-close" id="cc-calc-close">&times;</button>
        </div>
        <div class="cc-calc-body">
          <div class="cc-calc-input-group">
            <input type="number" id="cc-calc-from-amount" value="${this.fromAmount}" step="0.01" min="0" />
            <select id="cc-calc-from-currency">
              ${supportedCurrencies.map(c => `<option value="${c}" ${c === this.fromCurrency ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="cc-calc-swap">
            <button id="cc-calc-swap" title="交换货币">⇅</button>
          </div>
          <div class="cc-calc-input-group">
            <input type="number" id="cc-calc-to-amount" value="0" readonly />
            <select id="cc-calc-to-currency">
              ${supportedCurrencies.map(c => `<option value="${c}" ${c === this.toCurrency ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="cc-calc-rate" id="cc-calc-rate">
            1 ${this.fromCurrency} = 0 ${this.toCurrency}
          </div>
        </div>
      `;

      document.body.appendChild(this.panel);
      this.attachEvents();
      this.injectStyles();
      this.calculate(); // 初始计算
    }

    /**
     * 绑定事件
     */
    attachEvents() {
      // 关闭按钮
      this.panel.querySelector('#cc-calc-close').addEventListener('click', () => {
        this.hide();
      });

      // 拖拽
      const header = this.panel.querySelector('#cc-calc-header');
      header.addEventListener('mousedown', (e) => {
        if (e.target.id === 'cc-calc-close') return;
        this.isDragging = true;
        this.dragOffset.x = e.clientX - this.position.x;
        this.dragOffset.y = e.clientY - this.position.y;
        this.panel.style.cursor = 'grabbing';
        header.style.cursor = 'grabbing';
      });

      document.addEventListener('mousemove', (e) => {
        if (!this.isDragging) return;
        e.preventDefault();
        this.position.x = e.clientX - this.dragOffset.x;
        this.position.y = e.clientY - this.dragOffset.y;
        
        // 边界限制
        this.position.x = Math.max(0, Math.min(this.position.x, window.innerWidth - this.panel.offsetWidth));
        this.position.y = Math.max(0, Math.min(this.position.y, window.innerHeight - this.panel.offsetHeight));
        
        this.panel.style.left = `${this.position.x}px`;
        this.panel.style.top = `${this.position.y}px`;
      });

      document.addEventListener('mouseup', () => {
        if (this.isDragging) {
          this.isDragging = false;
          this.panel.style.cursor = '';
          header.style.cursor = '';
          this.savePosition();
        }
      });

      // 输入变化
      const fromAmountInput = this.panel.querySelector('#cc-calc-from-amount');
      const fromCurrencySelect = this.panel.querySelector('#cc-calc-from-currency');
      const toCurrencySelect = this.panel.querySelector('#cc-calc-to-currency');

      fromAmountInput.addEventListener('input', () => {
        let value = parseFloat(fromAmountInput.value);
        
        // 验证输入
        if (isNaN(value) || value < 0) {
          value = 0;
        }
        if (value > 999999999) {
          value = 999999999;
          fromAmountInput.value = value;
        }
        
        this.fromAmount = value;
        this.calculate();
      });

      // 失去焦点时格式化显示
      fromAmountInput.addEventListener('blur', () => {
        if (this.fromAmount > 0) {
          fromAmountInput.value = this.fromAmount.toFixed(2);
        }
      });

      // Enter键快速计算
      fromAmountInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          fromAmountInput.blur();
          this.calculate();
        }
      });

      fromCurrencySelect.addEventListener('change', () => {
        this.fromCurrency = fromCurrencySelect.value;
        this.saveCurrency('calcFromCurrency', this.fromCurrency);
        this.calculate();
      });

      toCurrencySelect.addEventListener('change', () => {
        this.toCurrency = toCurrencySelect.value;
        this.saveCurrency('calcToCurrency', this.toCurrency);
        this.calculate();
      });

      // 交换按钮
      this.panel.querySelector('#cc-calc-swap').addEventListener('click', () => {
        // 交换货币
        const tempCurrency = this.fromCurrency;
        this.fromCurrency = this.toCurrency;
        this.toCurrency = tempCurrency;
        
        // 交换金额（使用当前转换后的金额）
        const toAmountInput = this.panel.querySelector('#cc-calc-to-amount');
        const currentToAmount = parseFloat(toAmountInput.value) || 0;
        this.fromAmount = currentToAmount;
        fromAmountInput.value = this.fromAmount.toFixed(2);
        
        // 更新下拉框
        fromCurrencySelect.value = this.fromCurrency;
        toCurrencySelect.value = this.toCurrency;
        
        // 保存货币选择
        this.saveCurrency('calcFromCurrency', this.fromCurrency);
        this.saveCurrency('calcToCurrency', this.toCurrency);
        
        // 重新计算
        this.calculate();
      });
    }

    /**
     * 计算转换
     */
    async calculate() {
      try {
        // 获取汇率
        await this.rateManager.getRates('USD');
        
        const converted = this.rateManager.convert(this.fromAmount, this.fromCurrency, this.toCurrency);
        const rate = this.rateManager.convert(1, this.fromCurrency, this.toCurrency);
        
        // 更新显示
        const toAmountInput = this.panel.querySelector('#cc-calc-to-amount');
        const rateDisplay = this.panel.querySelector('#cc-calc-rate');
        
        toAmountInput.value = converted.toFixed(2);
        rateDisplay.textContent = `1 ${this.fromCurrency} = ${rate.toFixed(4)} ${this.toCurrency}`;
        rateDisplay.style.color = '#6b7280';
      } catch (error) {
        const toAmountInput = this.panel.querySelector('#cc-calc-to-amount');
        const rateDisplay = this.panel.querySelector('#cc-calc-rate');
        
        toAmountInput.value = '0.00';
        rateDisplay.textContent = '⚠️ 汇率数据不可用，请检查网络';
        rateDisplay.style.color = '#ef4444';
        
        console.warn('[CC] Calculator conversion failed:', error);
      }
    }

    /**
     * 显示计算器
     */
    show() {
      this.panel.style.display = 'block';
      this.calculate(); // 刷新汇率
      this.panel.querySelector('#cc-calc-from-amount').focus();
    }

    /**
     * 隐藏计算器
     */
    hide() {
      this.panel.style.display = 'none';
    }

    /**
     * 切换显示/隐藏
     */
    toggle() {
      if (this.panel.style.display === 'none') {
        this.show();
      } else {
        this.hide();
      }
    }

    /**
     * 注入样式
     */
    injectStyles() {
      GM_addStyle(`
        .cc-calculator-panel {
          position: fixed;
          width: 300px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1);
          z-index: 9999998;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .cc-calc-header {
          padding: 12px 16px;
          background: white;
          border-bottom: 1px solid #e5e7eb;
          border-radius: 8px 8px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: grab;
          user-select: none;
        }

        .cc-calc-header span {
          font-weight: 600;
          font-size: 14px;
          color: #1f2937;
        }

        .cc-calc-close {
          background: none;
          border: none;
          color: #6b7280;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .cc-calc-close:hover {
          background: #f3f4f6;
          color: #1f2937;
        }

        .cc-calc-body {
          padding: 16px;
        }

        .cc-calc-input-group {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .cc-calc-input-group input {
          flex: 1;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
        }

        .cc-calc-input-group input:read-only {
          background: #f9fafb;
          color: #6b7280;
        }

        .cc-calc-input-group input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .cc-calc-input-group select {
          padding: 10px 8px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          color: #1f2937;
          background: white;
          cursor: pointer;
        }

        .cc-calc-input-group select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .cc-calc-swap {
          display: flex;
          justify-content: center;
          margin: -6px 0;
        }

        .cc-calc-swap button {
          background: #f3f4f6;
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          font-size: 18px;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.2s;
        }

        .cc-calc-swap button:hover {
          background: #e5e7eb;
          color: #1f2937;
          transform: rotate(180deg);
        }

        .cc-calc-swap button:active {
          background: #d1d5db;
        }

        .cc-calc-rate {
          text-align: center;
          font-size: 12px;
          color: #6b7280;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #e5e7eb;
        }

        /* 暗色模式 */
        @media (prefers-color-scheme: dark) {
          .cc-calculator-panel {
            background: #1f2937;
            border-color: #374151;
          }

          .cc-calc-header {
            background: #1f2937;
            border-bottom-color: #374151;
          }

          .cc-calc-header span {
            color: #f3f4f6;
          }

          .cc-calc-close {
            color: #9ca3af;
          }

          .cc-calc-close:hover {
            background: #374151;
            color: #f3f4f6;
          }

          .cc-calc-input-group input,
          .cc-calc-input-group select {
            background: #374151;
            border-color: #4b5563;
            color: #f3f4f6;
          }

          .cc-calc-input-group input:read-only {
            background: #2d3748;
            color: #9ca3af;
          }

          .cc-calc-swap button {
            background: #374151;
            color: #9ca3af;
          }

          .cc-calc-swap button:hover {
            background: #4b5563;
            color: #f3f4f6;
          }

          .cc-calc-rate {
            border-top-color: #374151;
            color: #6b7280;
          }
        }
      `);
    }
  }

  /* ==================== 快捷键管理器 ==================== */
  
  /**
   * 快捷键管理器类
   * 处理全局快捷键
   */
  class KeyboardManager {
    constructor(calculatorPanel, tooltipManager) {
      this.calculator = calculatorPanel;
      this.tooltipManager = tooltipManager;
      this.init();
    }

    /**
     * 初始化快捷键监听
     */
    init() {
      document.addEventListener('keydown', (e) => {
        // Alt + C: 打开/关闭计算器
        if (e.altKey && e.key.toLowerCase() === 'c') {
          e.preventDefault();
          this.calculator.toggle();
          console.log('[CC] 快捷键: Alt+C - 切换计算器');
        }

        // Escape: 关闭计算器和所有tooltip
        if (e.key === 'Escape') {
          this.calculator.hide();
          if (this.tooltipManager.currentTooltip) {
            this.tooltipManager.hideTooltip();
          }
        }

        // Alt + H: 隐藏/显示所有价格标记
        if (e.altKey && e.key.toLowerCase() === 'h') {
          e.preventDefault();
          this.togglePriceHighlights();
          console.log('[CC] 快捷键: Alt+H - 切换价格标记');
        }
      });

      console.log('[CC] 快捷键已启用: Alt+C (计算器), Alt+H (切换标记), Esc (关闭)');
    }

    /**
     * 切换价格高亮显示
     */
    togglePriceHighlights() {
      const priceElements = document.querySelectorAll('.cc-price-detected');
      if (priceElements.length === 0) return;

      const firstElement = priceElements[0];
      const isHidden = firstElement.style.textDecoration === 'none';

      priceElements.forEach(el => {
        if (isHidden) {
          el.style.textDecoration = ''; // 恢复下划线
          el.style.textDecorationStyle = '';
          el.style.textDecorationColor = '';
        } else {
          el.style.textDecoration = 'none'; // 隐藏下划线
        }
      });
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
    console.log('%c💱 Currency Converter v1.3.0 Loaded', 
      'color: #667eea; font-size: 14px; font-weight: bold;');

    try {
      // 1. 实例化配置管理器
      const configManager = new ConfigManager();
      console.log('[CC] ConfigManager initialized');

      // 2. 实例化汇率管理器
      const rateManager = new ExchangeRateManager(configManager);
      console.log('[CC] ExchangeRateManager initialized');

      // 3. 实例化地理位置检测器
      const geoDetector = new GeoLocationDetector(configManager);
      console.log('[CC] GeoLocationDetector initialized');

      // 3.5. 检测用户所在国家货币（异步，不阻塞）
      geoDetector.detectUserCurrency().catch(err => {
        console.warn('[CC] 地理位置检测失败（不影响功能）:', err.message);
      });

      // 4. 实例化价格检测器
      const detector = new CurrencyDetector(configManager);
      console.log('[CC] CurrencyDetector initialized');

      // 5. 实例化工具提示管理器
      const tooltipManager = new TooltipManager(rateManager, configManager);
      console.log('[CC] TooltipManager initialized');

      // 5.5. 实例化设置面板
      const settingsPanel = new SettingsPanel(configManager);
      console.log('[CC] SettingsPanel initialized');

      // 5.6. 实例化货币计算器
      const calculator = new CalculatorPanel(rateManager, configManager);
      console.log('[CC] CalculatorPanel initialized');

      // 5.7. 实例化快捷键管理器
      const keyboardManager = new KeyboardManager(calculator, tooltipManager);
      console.log('[CC] KeyboardManager initialized');

      // 5.8. 添加计算器菜单命令
      GM_registerMenuCommand('💱 货币计算器 (Alt+C)', () => {
        calculator.toggle();
      });

      // 6. 延迟扫描页面（性能优化）
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          detector.scanPage();
        }, { timeout: 2000 });
      } else {
        setTimeout(() => {
          detector.scanPage();
        }, 1000);
      }

      // 7. 设置动态内容监听
      setupDynamicObserver(detector);

      // 8. 预加载汇率数据
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

