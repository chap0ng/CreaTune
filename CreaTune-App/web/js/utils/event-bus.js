// event-bus.js
// Simple event bus for inter-module communication

// Check if EventBus already exists to prevent overriding
if (!window.EventBus) {
  // Create EventBus object
  const EventBus = {
    events: {},

    /**
     * Subscribe to an event
     * @param {string} eventName - Name of the event to subscribe to
     * @param {function} callback - Function to call when event is emitted
     * @returns {function} - Unsubscribe function
     */
    subscribe: function(eventName, callback) {
      // Create event array if it doesn't exist
      if (!this.events[eventName]) {
        this.events[eventName] = [];
      }
      
      // Add callback to event array
      this.events[eventName].push(callback);
      
      // Return unsubscribe function
      return () => {
        this.events[eventName] = this.events[eventName].filter(
          eventCallback => eventCallback !== callback
        );
      };
    },

    /**
     * Emit an event with data
     * @param {string} eventName - Name of the event to emit
     * @param {any} data - Data to pass to subscribers
     */
    emit: function(eventName, data) {
      if (this.events[eventName]) {
        // Call each subscriber callback with data
        this.events[eventName].forEach(callback => {
          try {
            callback(data);
          } catch (err) {
            console.error(`Error in EventBus handler for '${eventName}':`, err);
          }
        });
      }
    },

    /**
     * Clear all event subscriptions or specific event subscriptions
     * @param {string} [eventName] - Optional name of event to clear
     */
    clear: function(eventName) {
      if (eventName) {
        // Clear specific event
        delete this.events[eventName];
      } else {
        // Clear all events
        this.events = {};
      }
    }
  };

  // Export for use in modules
  window.EventBus = EventBus;
  console.log('EventBus initialized and exported to window');
} else {
  console.log('EventBus already exists, skipping initialization');
}
