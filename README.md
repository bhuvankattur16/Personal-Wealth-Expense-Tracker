WealthTrack — Personal Wealth & Expense Tracker

WealthTrack is a modern, client-side web application designed to help you manage your personal finances. Track your income and expenses, visualize your spending patterns, and maintain a persistent history of your financial transactions without the need for a backend server.

Tech Stack

- **HTML5 & CSS3 (Vanilla)**: For a semantic structure and a premium, responsive user interface using Flexbox, CSS Grid, and custom properties for a polished design system.
- **JavaScript (ES6+)**: Core application logic, DOM manipulation, and state management.
- **[Chart.js](https://www.chartjs.org/)**: A powerful charting library used to generate dynamic pie and bar charts for financial visualization.
- **IndexedDB**: A robust, transactional, client-side database used for persistent data storage across browser sessions.
- **Google Fonts (Inter)**: Premium typography for enhanced readability and modern aesthetics.
- **SVG Icons**: Lightweight, scalable vector graphics for a clean and crisp interface.

### Why this stack?
I chose a lightweight, vanilla-first approach to ensure maximum performance and minimal overhead. Using **IndexedDB** allows for a complete "offline-first" experience where data is stored securely on your device. **Chart.js** was selected for its balance of ease of use and rich feature set for financial data representation.

## 🛠️ Setup Instructions

This project is a static web application and requires no complex build steps or dependencies.

1.  **Download or Clone** the repository to your local machine.
2.  **Open** the `index.html` file in any modern web browser (Chrome, Firefox, Edge, or Safari).
3.  **Start tracking!** No `npm install` or local server is required, as all external libraries are loaded via reliable CDNs.

## ⚖️ Trade-offs & Future Improvements

### Trade-offs Taken
-   **Client-Side Persistence Only**: Using IndexedDB means your data is tied to your specific browser and device. While great for privacy and simplicity, it prevents cross-device syncing.
-   **CDN Dependencies**: Currently, Chart.js is fetched via CDN to keep the project setup simple. In a production environment, bundling these dependencies would improve load times and reliability.
-   **Manual Data Entry**: All transactions must be entered manually, which might be a barrier for users with many transactions.

### Planned Improvements
-   **CSV Import/Export**: Allow users to import bank statements or export their data for external analysis in Excel/Google Sheets.
-   **Multi-Currency Support**: Add support for multiple currencies with automatic exchange rate conversion.
-   **Enhanced Analytics**: Implement time-series line charts to show wealth trends over months and years.
-   **Monthly Budgets**: Allow users to set spending limits for specific categories and receive visual alerts when approaching them.
-   **PWA Support**: Turn WealthTrack into a Progressive Web App for an installable mobile experience.
