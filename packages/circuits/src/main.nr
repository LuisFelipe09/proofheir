use dep::sha256;

fn main(
    // Public Inputs
    recipient: pub [u8; 20],      // To prevent front-running
    server_hash: pub [u8; 32],    // Expected Server Identity Hash (SHA256)
    id_commitment: pub [u8; 32],  // Expected Identity Hash (SHA256(nuip + salt))
    status_commitment: pub [u8; 32], // TLS Commitment for the Status field (SHA256)

    // Private Inputs (Authenticated Data from TLS)
    nuip: str<15>,               // e.g. "1234567890"
    salt: [u8; 32],              // Salt derived from email
    server_domain: str<40>,      // e.g. "civil-registry-mock.onrender.com"
    status: str<22>,             // "No Vigente (Fallecido)"
    status_blinder: [u8; 16]     // Blinder for the status commitment
) {
    // 1. Check Status Content
    let is_dead = check_status(status);
    assert(is_dead);

    // 2. Check Status Commitment
    let status_valid = check_status_commitment(status, status_blinder, status_commitment);
    assert(status_valid);

    // 3. Check Server Identity
    let server_valid = check_server_identity(server_domain, server_hash);
    assert(server_valid);

    // 4. Check Identity
    let identity_valid = check_identity(nuip, salt, id_commitment);
    assert(identity_valid);
}

fn check_status(status: str<22>) -> bool {
    let expected_status = "No Vigente (Fallecido)";
    let is_equal = status == expected_status;
    println(f"Is Dead? {is_equal}");
    is_equal
}

fn check_status_commitment(status: str<22>, blinder: [u8; 16], commitment: [u8; 32]) -> bool {
    // 22 bytes status + 16 bytes blinder = 38 bytes
    let input = make_status_input(status, blinder);
    let computed_hash = sha256::sha256_var(input, 38);
    let is_valid = computed_hash == commitment;
    println(f"Status Commitment Valid? {is_valid}");
    is_valid
}

fn check_server_identity(server_domain: str<40>, expected_hash: [u8; 32]) -> bool {
    // 40 bytes domain
    let computed_hash = sha256::sha256_var(server_domain.as_bytes(), 40);
    let is_valid = computed_hash == expected_hash;
    println(f"Server Identity Valid? {is_valid}");
    is_valid
}

fn check_identity(nuip: str<15>, salt: [u8; 32], expected_hash: [u8; 32]) -> bool {
    // 15 bytes nuip + 32 bytes salt = 47 bytes
    let input = make_identity_input(nuip, salt);
    let computed_hash = sha256::sha256_var(input, 47);
    let is_valid = computed_hash == expected_hash;
    println(f"Identity Valid? {is_valid}");
    is_valid
}

fn make_status_input(status: str<22>, blinder: [u8; 16]) -> [u8; 38] {
    let mut input: [u8; 38] = [0; 38];
    let status_bytes = status.as_bytes();
    for i in 0..22 {
        input[i] = status_bytes[i];
    }
    for i in 0..16 {
        input[22 + i] = blinder[i];
    }
    input
}

fn make_identity_input(nuip: str<15>, salt: [u8; 32]) -> [u8; 47] {
    let mut input: [u8; 47] = [0; 47];
    let nuip_bytes = nuip.as_bytes();
    for i in 0..15 {
        input[i] = nuip_bytes[i];
    }
    for i in 0..32 {
        input[15 + i] = salt[i];
    }
    input
}

#[test]
fn test_main() {
    let recipient = [0xabu8; 20];
    
    let nuip: str<15> = "123456789012345";
    let salt = [0x11u8; 32];
    let server_domain: str<40> = "civil-registry-mock.onrender.com        "; // padded to 40
    let status: str<22> = "No Vigente (Fallecido)";
    let status_blinder = [0x22u8; 16];

    // Compute expected commitments
    let server_hash = sha256::sha256_var(server_domain.as_bytes(), 40);
    
    let id_input = make_identity_input(nuip, salt);
    let id_commitment = sha256::sha256_var(id_input, 47);

    let status_input = make_status_input(status, status_blinder);
    let status_commitment = sha256::sha256_var(status_input, 38);

    main(
        recipient,
        server_hash,
        id_commitment,
        status_commitment,
        nuip,
        salt,
        server_domain,
        status,
        status_blinder
    );
}

#[test(should_fail)]
fn test_main_wrong_status() {
    let recipient = [0xabu8; 20];
    let nuip: str<15> = "123456789012345";
    let salt = [0x11u8; 32];
    let server_domain: str<40> = "civil-registry-mock.onrender.com        "; // padded to 40
    let status: str<22> = "Vigente (Vivo)        "; 
    let status_blinder = [0x22u8; 16];

    let server_hash = sha256::sha256_var(server_domain.as_bytes(), 40);
    
    let id_input = make_identity_input(nuip, salt);
    let id_commitment = sha256::sha256_var(id_input, 47);

    let status_input = make_status_input(status, status_blinder);
    let status_commitment = sha256::sha256_var(status_input, 38);

    main(
        recipient,
        server_hash,
        id_commitment,
        status_commitment,
        nuip,
        salt,
        server_domain,
        status,
        status_blinder
    );
}
