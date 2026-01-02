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
    // 1. Verify Status Content
    let expected_status = "No Vigente (Fallecido)";
    assert(status == expected_status);

    // 2. Verify Status Link to TLS (Commitment Check)
    let status_hash_valid = verify_commitment(status.as_bytes(), status_blinder, status_commitment);
    assert(status_hash_valid);

    // 3. Verify Server Identity
    let computed_server_hash = sha256::digest(server_domain.as_bytes());
    assert(computed_server_hash == server_hash);

    // 4. Verify Identity (Who is this?)
    let computed_id_hash = hash_id_salt(nuip, salt);
    assert(computed_id_hash == id_commitment);
}

// Specialized for N=22 (status length)
fn verify_commitment(data: [u8; 22], blinder: [u8; 16], commitment: [u8; 32]) -> bool {
    let mut input: [u8; 38] = [0; 38];
    for i in 0..22 {
        input[i] = data[i];
    }
    for i in 0..16 {
        input[22 + i] = blinder[i];
    }
    
    let computed = sha256::digest(input);
    computed == commitment
}

fn hash_id_salt(id: str<15>, salt: [u8; 32]) -> [u8; 32] {
    let id_bytes = id.as_bytes();
    let mut input: [u8; 47] = [0; 47];
    
    for i in 0..15 {
        input[i] = id_bytes[i];
    }
    for i in 0..32 {
        input[15 + i] = salt[i];
    }

    sha256::digest(input)
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
    let server_hash = sha256::digest(server_domain.as_bytes());
    let id_commitment = hash_id_salt(nuip, salt);

    let mut status_input: [u8; 38] = [0; 38];
    let status_bytes = status.as_bytes();
    for i in 0..22 {
        status_input[i] = status_bytes[i];
    }
    for i in 0..16 {
        status_input[22 + i] = status_blinder[i];
    }
    let status_commitment = sha256::digest(status_input);

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
    let server_domain: str<40> = "civil-registry-mock.onrender.com        ";
    let status: str<22> = "Vigente (Vivo)        "; 
    let status_blinder = [0x22u8; 16];

    let server_hash = sha256::digest(server_domain.as_bytes());
    let id_commitment = hash_id_salt(nuip, salt);
    
    let mut status_input: [u8; 38] = [0; 38];
    let status_bytes = status.as_bytes();
    for i in 0..22 {
        status_input[i] = status_bytes[i];
    }
    for i in 0..16 {
        status_input[22 + i] = status_blinder[i];
    }
    let status_commitment = sha256::digest(status_input);

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
