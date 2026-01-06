mod proof;

use axum::{
    http::{HeaderValue, Method},
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Serialize)]
struct HealthResponse {
    status: String,
}

#[tokio::main]
async fn main() {
    // Load .env file from workspace root
    // Try multiple paths to find .env
    let env_paths = vec![
        "../../.env",
        ".env",
        "../.env",
    ];
    
    for path in env_paths {
        if dotenvy::from_path(path).is_ok() {
            eprintln!("✅ Loaded .env from: {}", path);
            break;
        }
    }
    
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "proofheir_api=info,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Configure CORS - allow origin from environment variable or default to localhost
    let allowed_origin = std::env::var("ALLOWED_ORIGIN")
        .unwrap_or_else(|_| "http://localhost:3000".to_string());
    
    tracing::info!("📡 CORS allowed origin: {}", allowed_origin);
    
    let cors = CorsLayer::new()
        .allow_origin(allowed_origin.parse::<HeaderValue>().unwrap())
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    // Build router
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/generate-proof", post(proof::generate_proof))
        .layer(cors);

    // Start server - bind address from environment or default
    // Render uses PORT env var, so check that first
    let bind_address = if let Ok(port) = std::env::var("PORT") {
        format!("0.0.0.0:{}", port)
    } else {
        std::env::var("BIND_ADDRESS")
            .unwrap_or_else(|_| "0.0.0.0:3001".to_string())
    };
    
    tracing::info!("🚀 ProofHeir API server starting on {}", bind_address);
    tracing::info!("🔗 Endpoints:");
    tracing::info!("   GET  /health");
    tracing::info!("   POST /api/generate-proof");

    let listener = tokio::net::TcpListener::bind(&bind_address).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

/// GET /health - Health check endpoint
async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
    })
}
