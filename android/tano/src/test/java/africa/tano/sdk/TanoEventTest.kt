package africa.tano.sdk

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TanoEventTest {
    @Test
    fun litLesEvenementsDuParcours() {
        assertEquals(TanoEvent.Ready, TanoEvent.parse("""{"type":"tano:ready","version":1}"""))
        assertEquals(TanoEvent.Step("face"), TanoEvent.parse("""{"type":"tano:step","step":"face"}"""))
        assertEquals(TanoEvent.Completed, TanoEvent.parse("""{"type":"tano:completed"}"""))
        assertEquals(TanoEvent.Ended("expired"), TanoEvent.parse("""{"type":"tano:ended","reason":"expired"}"""))
    }

    @Test
    fun ignoreCeQuiNEstPasUnEvenement() {
        assertNull(TanoEvent.parse("pas du json"))
        assertNull(TanoEvent.parse("""{"type":"tano:resize","height":800}"""))
        assertNull(TanoEvent.parse("""{"type":"tano:step"}"""))
    }

    @Test
    fun nAdmetQueHttpsOuLocalhost() {
        assertTrue(TanoJourneyUrl.isAllowed("https", "verify.tano.africa"))
        assertTrue(TanoJourneyUrl.isAllowed("http", "localhost"))
        assertFalse(TanoJourneyUrl.isAllowed("http", "verify.tano.africa"))
        assertFalse(TanoJourneyUrl.isAllowed("javascript", null))
    }
}
