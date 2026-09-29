import XCTest

@testable import TanoSDK

final class TanoEventTests: XCTestCase {
    func testParsesJourneyEvents() {
        XCTAssertEqual(TanoEvent(message: #"{"type":"tano:ready","version":1}"#), .ready)
        XCTAssertEqual(TanoEvent(message: #"{"type":"tano:step","step":"face"}"#), .step("face"))
        XCTAssertEqual(TanoEvent(message: #"{"type":"tano:completed"}"#), .completed)
        XCTAssertEqual(
            TanoEvent(message: #"{"type":"tano:ended","reason":"expired"}"#), .ended("expired"))
    }

    func testIgnoresNonEvents() {
        XCTAssertNil(TanoEvent(message: "pas du json"))
        XCTAssertNil(TanoEvent(message: #"{"type":"tano:resize","height":800}"#))
        XCTAssertNil(TanoEvent(message: #"{"type":"tano:step"}"#))
    }

    func testAcceptsOnlyHttpsOrLocalhost() throws {
        XCTAssertNotNil(TanoJourneyURL.validated(try XCTUnwrap(URL(string: "https://verify.tano.africa/#t"))))
        XCTAssertNotNil(TanoJourneyURL.validated(try XCTUnwrap(URL(string: "http://localhost:5188/#t"))))
        XCTAssertNil(TanoJourneyURL.validated(try XCTUnwrap(URL(string: "http://verify.tano.africa/#t"))))
    }

    func testSameOrigin() throws {
        let journey = try XCTUnwrap(URL(string: "https://verify.tano.africa/#t"))
        XCTAssertTrue(TanoJourneyURL.sameOrigin(journey, try XCTUnwrap(URL(string: "https://verify.tano.africa:443/v1/x"))))
        XCTAssertFalse(TanoJourneyURL.sameOrigin(journey, try XCTUnwrap(URL(string: "https://evil.example/"))))
    }
}
